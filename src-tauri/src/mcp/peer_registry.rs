//! MCP Peer Registry
//!
//! Thread-safe registry of connected MCP peers and their resource subscriptions.
//! Used by the notification dispatcher to determine which peers should receive
//! `notifications/resources/updated` messages when engine state changes.

use dashmap::DashMap;
use rmcp::service::{Peer, RoleServer};
use std::collections::HashSet;
use std::sync::Arc;

/// Entry for a single connected peer.
struct PeerEntry {
    /// Handle to send notifications to this peer
    peer: Peer<RoleServer>,
    /// Set of resource URIs this peer has subscribed to
    subscribed_uris: HashSet<String>,
}

/// Thread-safe registry of connected MCP peers.
///
/// Peers are registered when they connect (via `on_initialized`) and
/// unregistered when they disconnect. URI subscriptions are tracked
/// per-peer so the dispatcher only notifies interested clients.
#[derive(Clone)]
pub struct PeerRegistry {
    /// Map: peer_id -> PeerEntry
    peers: Arc<DashMap<String, PeerEntry>>,
    /// Counter for generating unique peer IDs
    next_id: Arc<std::sync::atomic::AtomicU64>,
}

impl PeerRegistry {
    /// Create a new empty registry.
    pub fn new() -> Self {
        Self {
            peers: Arc::new(DashMap::new()),
            next_id: Arc::new(std::sync::atomic::AtomicU64::new(1)),
        }
    }

    /// Generate a unique peer ID.
    pub fn next_peer_id(&self) -> String {
        let id = self
            .next_id
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        format!("peer-{}", id)
    }

    /// Register a newly connected peer.
    pub fn register(&self, peer_id: String, peer: Peer<RoleServer>) {
        self.peers.insert(
            peer_id,
            PeerEntry {
                peer,
                subscribed_uris: HashSet::new(),
            },
        );
    }

    /// Unregister a peer (e.g., on disconnect).
    pub fn unregister(&self, peer_id: &str) {
        self.peers.remove(peer_id);
    }

    /// Record that a peer has subscribed to a resource URI.
    pub fn subscribe(&self, peer_id: &str, uri: String) {
        if let Some(mut entry) = self.peers.get_mut(peer_id) {
            entry.subscribed_uris.insert(uri);
        }
    }

    /// Remove a URI subscription for a peer.
    pub fn unsubscribe(&self, peer_id: &str, uri: &str) {
        if let Some(mut entry) = self.peers.get_mut(peer_id) {
            entry.subscribed_uris.remove(uri);
        }
    }

    /// Get all peers that have subscribed to a URI matching the given value.
    ///
    /// Returns cloned `Peer<RoleServer>` handles for each matching subscriber.
    /// Also removes peers whose transport is closed (stale connections).
    pub fn get_subscribers(&self, uri: &str) -> Vec<Peer<RoleServer>> {
        let mut stale_peers = Vec::new();
        let mut result = Vec::new();

        for entry in self.peers.iter() {
            // Check if the transport is still alive
            if entry.value().peer.is_transport_closed() {
                stale_peers.push(entry.key().clone());
                continue;
            }

            if entry.value().subscribed_uris.contains(uri) {
                result.push(entry.value().peer.clone());
            }
        }

        // Clean up stale peers
        for peer_id in stale_peers {
            self.peers.remove(&peer_id);
        }

        result
    }

    /// Get ALL connected peers (regardless of subscriptions).
    ///
    /// Used for notifications that should reach all clients,
    /// such as resource list changes.
    pub fn get_all_peers(&self) -> Vec<Peer<RoleServer>> {
        let mut stale_peers = Vec::new();
        let mut result = Vec::new();

        for entry in self.peers.iter() {
            if entry.value().peer.is_transport_closed() {
                stale_peers.push(entry.key().clone());
                continue;
            }
            result.push(entry.value().peer.clone());
        }

        // Clean up stale peers
        for peer_id in stale_peers {
            self.peers.remove(&peer_id);
        }

        result
    }
}

impl Default for PeerRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: Peer<RoleServer> requires an actual transport, so we test
    // the registry logic at the integration level. Unit tests here verify
    // the basic data structure operations with a mock-free approach.

    #[test]
    fn test_peer_id_generation() {
        let registry = PeerRegistry::new();
        let id1 = registry.next_peer_id();
        let id2 = registry.next_peer_id();
        assert_ne!(id1, id2);
        assert!(id1.starts_with("peer-"));
        assert!(id2.starts_with("peer-"));
    }
}
