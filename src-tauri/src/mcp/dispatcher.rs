//! MCP Notification Dispatcher
//!
//! Background task that bridges the engine's broadcast channel to MCP peer notifications.
//! When the engine commits events, the dispatcher determines which resource URIs were
//! affected and sends `notifications/resources/updated` to subscribed MCP peers.

use crate::mcp::notifications::StateChangeEvent;
use crate::mcp::peer_registry::PeerRegistry;
use crate::state::AppState;
use rmcp::model::ResourceUpdatedNotificationParam;
use std::sync::Arc;
use tokio::sync::broadcast;

/// Run the notification dispatcher loop.
///
/// This task listens on the broadcast channel for `StateChangeEvent`s,
/// derives affected resource URIs, and notifies subscribed MCP peers.
///
/// The function runs until the broadcast sender is dropped (app shutdown).
pub async fn run_notification_dispatcher(
    mut rx: broadcast::Receiver<StateChangeEvent>,
    registry: PeerRegistry,
    app_state: Arc<AppState>,
) {
    loop {
        match rx.recv().await {
            Ok(event) => {
                let uris = derive_resource_uris(&event, &app_state);
                notify_peers(&registry, &uris).await;
            }
            Err(broadcast::error::RecvError::Lagged(count)) => {
                // We missed some events due to slow processing.
                // Log and continue; the next event will trigger a notification.
                log::warn!(
                    "MCP dispatcher lagged behind by {} events, some notifications may have been missed",
                    count
                );
            }
            Err(broadcast::error::RecvError::Closed) => {
                // Sender was dropped — app is shutting down.
                log::info!("MCP notification dispatcher shutting down (broadcast channel closed)");
                break;
            }
        }
    }
}

/// Derive the set of resource URIs affected by a state change event.
///
/// Maps engine events to MCP resource URIs so the dispatcher knows which
/// subscribed peers to notify. The URI scheme matches the resources defined
/// in `server.rs::list_resources`.
fn derive_resource_uris(event: &StateChangeEvent, app_state: &AppState) -> Vec<String> {
    // Resolve the file_id to a project path for URI construction.
    // The resource URIs use the file path (project), not file_id.
    let project = match app_state.files.get(&event.file_id) {
        Some(info) => info.path.to_string_lossy().to_string(),
        None => {
            // File was closed between commit and notification — skip.
            return Vec::new();
        }
    };

    let mut uris = Vec::new();

    // Always include the events resource (any change updates the event log)
    uris.push(format!("elfiee://{}/events", project));

    for ev in &event.events {
        let cap_id = extract_cap_id(&ev.attribute);

        match cap_id {
            // Block lifecycle events
            "core.create" | "core.delete" => {
                // Block list changed
                uris.push(format!("elfiee://{}/blocks", project));
                // Individual block changed
                uris.push(format!("elfiee://{}/block/{}", project, ev.entity));
            }

            // Content write events (block content changed)
            "markdown.write"
            | "code.write"
            | "directory.write"
            | "directory.create"
            | "directory.delete"
            | "directory.rename"
            | "directory.import"
            | "core.rename"
            | "core.change_type"
            | "core.update_metadata"
            | "core.link"
            | "core.unlink"
            | "terminal.init"
            | "terminal.execute"
            | "terminal.save"
            | "terminal.close" => {
                uris.push(format!("elfiee://{}/block/{}", project, ev.entity));
            }

            // Permission events
            "core.grant" | "core.revoke" => {
                uris.push(format!("elfiee://{}/grants", project));
            }

            // Editor events
            "editor.create" | "editor.delete" => {
                // Editor changes don't map to a specific resource URI currently,
                // but they do affect the events log (already included above).
            }

            _ => {
                // Unknown capability — only events resource (already included).
            }
        }
    }

    // Deduplicate
    uris.sort();
    uris.dedup();

    uris
}

/// Send resource-updated notifications to all peers subscribed to the given URIs.
async fn notify_peers(registry: &PeerRegistry, uris: &[String]) {
    for uri in uris {
        let peers = registry.get_subscribers(uri);
        for peer in peers {
            let result = peer
                .notify_resource_updated(ResourceUpdatedNotificationParam { uri: uri.clone() })
                .await;
            if let Err(e) = result {
                log::debug!("Failed to notify peer about {}: {}", uri, e);
            }
        }
    }
}

/// Extract the capability ID from an event attribute.
///
/// Attribute format: `{editor_id}/{cap_id}` (e.g., "alice/markdown.write")
fn extract_cap_id(attribute: &str) -> &str {
    attribute.split('/').nth(1).unwrap_or("")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_cap_id() {
        assert_eq!(extract_cap_id("alice/markdown.write"), "markdown.write");
        assert_eq!(extract_cap_id("bob/core.create"), "core.create");
        assert_eq!(extract_cap_id("system/core.grant"), "core.grant");
        assert_eq!(extract_cap_id("no-slash"), "");
    }
}
