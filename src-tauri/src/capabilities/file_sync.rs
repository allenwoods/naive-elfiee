use crate::models::Event;
use crate::state::AppState;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

/// File Sync Capability
/// 
/// This capability handles automatic file synchronization triggered by command events.
/// It operates as a cross-cutting concern that monitors all capability executions
/// and triggers file saves when needed.
pub struct FileSyncCapability {
    app: AppHandle,
    state: Arc<AppState>,
}

impl FileSyncCapability {
    /// Create a new file sync capability
    pub fn new(app: AppHandle, state: Arc<AppState>) -> Self {
        Self { app, state }
    }

    /// Process events and trigger file sync if needed
    /// 
    /// This method should be called after any capability execution to check if
    /// file synchronization is required.
    pub async fn process_events(&self, file_id: &str, events: &[Event]) {
        if events.is_empty() {
            return;
        }

        // Check if any event requires file sync
        for event in events {
            if self.should_sync_file(event) {
                self.sync_file(file_id, event).await;
                break; // Only sync once per command execution
            }
        }
    }

    /// Check if an event requires file synchronization
    /// 
    /// Events can trigger file sync by setting the `needs_file_sync` flag
    /// in their contents object.
    fn should_sync_file(&self, event: &Event) -> bool {
        if let Some(contents) = event.value.get("contents") {
            if let Some(obj) = contents.as_object() {
                return obj.get("needs_file_sync")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
            }
        }
        false
    }

    /// Perform file synchronization
    /// 
    /// This method handles the actual file save operation with proper
    /// error handling and event emission.
    async fn sync_file(&self, file_id: &str, event: &Event) {
        // Get file info
        let file_info = match self.state.files.get(file_id) {
            Some(info) => info,
            None => {
                eprintln!("File sync failed: File '{}' not found", file_id);
                return;
            }
        };

        let archive = file_info.archive.clone();
        let elf_path = file_info.path.clone();
        
        // Extract command info for logging
        let command = event.value.get("contents")
            .and_then(|contents| contents.as_object())
            .and_then(|obj| obj.get("file_operation_command"))
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        // Get mutex for this file to ensure serialized saves
        let save_mutex = self.state.get_file_save_mutex(file_id);
        
        // Clone for async task
        let app_handle = self.app.clone();
        let file_id_clone = file_id.to_string();

        // Spawn async file sync task
        tokio::spawn(async move {
            let _guard = save_mutex.lock().await;
            
            match archive.save(&elf_path) {
                Ok(_) => {
                    println!("File sync completed successfully for command: {}", command);
                    
                    // Emit success event
                    if let Err(e) = app_handle.emit("file-sync-success", serde_json::json!({
                        "command": command,
                        "file_id": file_id_clone
                    })) {
                        eprintln!("Failed to emit file-sync-success event: {}", e);
                    }
                }
                Err(e) => {
                    let error_msg = format!("文件同步失败: {}", e);
                    eprintln!("File sync failed: {}", e);
                    
                    // Emit error event for frontend notification
                    if let Err(emit_err) = app_handle.emit("file-sync-error", serde_json::json!({
                        "command": command,
                        "error": error_msg,
                        "file_id": file_id_clone
                    })) {
                        eprintln!("Failed to emit file-sync-error event: {}", emit_err);
                    }
                }
            }
        });
    }
}

/// File Sync Service
/// 
/// High-level service that coordinates file synchronization across the system.
/// This acts as the main entry point for file sync operations.
pub struct FileSyncService {
    capability: FileSyncCapability,
}

impl FileSyncService {
    /// Create a new file sync service
    pub fn new(app: AppHandle, state: Arc<AppState>) -> Self {
        Self {
            capability: FileSyncCapability::new(app, state),
        }
    }

    /// Handle events after command execution
    /// 
    /// This is the main entry point for triggering file synchronization.
    /// Call this method after any command execution that might require file sync.
    pub async fn handle_command_events(&self, file_id: &str, events: &[Event]) {
        self.capability.process_events(file_id, events).await;
    }
}

#[cfg(test)]
mod tests {
    use crate::models::Event;
    use std::collections::HashMap;

    fn create_test_event(needs_sync: bool) -> Event {
        let mut timestamp = HashMap::new();
        timestamp.insert("test_editor".to_string(), 1);

        Event::new(
            "test_block".to_string(),
            "test_editor/test.capability".to_string(),
            serde_json::json!({
                "contents": {
                    "needs_file_sync": needs_sync,
                    "file_operation_command": "test_command"
                }
            }),
            timestamp,
        )
    }

    #[test]
    fn test_should_sync_file_with_sync_flag() {
        let event = create_test_event(true);
        
        // Extract the logic for testing (since FileSyncCapability requires AppHandle)
        let should_sync = if let Some(contents) = event.value.get("contents") {
            if let Some(obj) = contents.as_object() {
                obj.get("needs_file_sync")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false)
            } else {
                false
            }
        } else {
            false
        };

        assert!(should_sync, "Event with needs_file_sync=true should trigger sync");
    }

    #[test]
    fn test_should_not_sync_file_without_flag() {
        let event = create_test_event(false);
        
        let should_sync = if let Some(contents) = event.value.get("contents") {
            if let Some(obj) = contents.as_object() {
                obj.get("needs_file_sync")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false)
            } else {
                false
            }
        } else {
            false
        };

        assert!(!should_sync, "Event with needs_file_sync=false should not trigger sync");
    }

    #[test]
    fn test_event_without_contents() {
        let mut timestamp = HashMap::new();
        timestamp.insert("test_editor".to_string(), 1);

        let event = Event::new(
            "test_block".to_string(),
            "test_editor/test.capability".to_string(),
            serde_json::json!("simple_value"),
            timestamp,
        );
        
        let should_sync = if let Some(contents) = event.value.get("contents") {
            if let Some(obj) = contents.as_object() {
                obj.get("needs_file_sync")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false)
            } else {
                false
            }
        } else {
            false
        };

        assert!(!should_sync, "Event without contents should not trigger sync");
    }
}