use crate::engine::{spawn_engine, EngineHandle};
use dashmap::DashMap;
use sqlx::SqlitePool;
use std::sync::Arc;

/// Manages multiple engine instances (one per .elf file).
///
/// This manager provides thread-safe concurrent access to multiple engine actors,
/// allowing the application to work with multiple .elf files simultaneously.
/// Each file is identified by a unique file_id.
pub struct EngineManager {
    /// Map: file_id -> EngineHandle
    engines: Arc<DashMap<String, EngineHandle>>,
}

impl EngineManager {
    /// Create a new empty engine manager.
    pub fn new() -> Self {
        Self {
            engines: Arc::new(DashMap::new()),
        }
    }

    /// Spawn a new engine for a .elf file.
    ///
    /// If an engine already exists for this file_id, returns an error.
    /// The engine will start processing commands immediately.
    ///
    /// # Arguments
    /// * `file_id` - Unique identifier for the .elf file
    /// * `event_pool` - SQLite connection pool for this file's event store
    ///
    /// # Returns
    /// A handle to communicate with the spawned engine actor.
    pub async fn spawn_engine(
        &self,
        file_id: String,
        event_pool: SqlitePool,
    ) -> Result<EngineHandle, String> {
        // Check if engine already exists
        if self.engines.contains_key(&file_id) {
            return Err(format!("Engine for file '{}' already exists", file_id));
        }

        // Spawn new engine (registry is created inside the actor)
        let handle = spawn_engine(file_id.clone(), event_pool).await?;

        // Store handle
        self.engines.insert(file_id.clone(), handle.clone());

        Ok(handle)
    }

    /// Get a handle to an existing engine.
    ///
    /// Returns None if no engine exists for this file_id.
    pub fn get_engine(&self, file_id: &str) -> Option<EngineHandle> {
        self.engines.get(file_id).map(|entry| entry.value().clone())
    }

    /// Shutdown an engine for a specific file.
    ///
    /// Sends a shutdown message to the engine and removes it from the manager.
    /// Returns an error if no engine exists for this file_id.
    pub async fn shutdown_engine(&self, file_id: &str) -> Result<(), String> {
        // Get the handle
        let handle = self
            .engines
            .get(file_id)
            .map(|entry| entry.value().clone())
            .ok_or_else(|| format!("No engine found for file '{}'", file_id))?;

        // Send shutdown message
        handle.shutdown().await;

        // Remove from map
        self.engines.remove(file_id);

        Ok(())
    }

    /// Shutdown all engines.
    ///
    /// Sends shutdown messages to all engines and clears the manager.
    /// Returns Ok(()) even if some engines fail to shutdown gracefully.
    pub async fn shutdown_all(&self) -> Result<(), String> {
        let mut errors = Vec::new();

        // Collect all file_ids first to avoid holding references during shutdown
        let file_ids: Vec<String> = self
            .engines
            .iter()
            .map(|entry| entry.key().clone())
            .collect();

        // Shutdown each engine
        for file_id in file_ids {
            if let Err(e) = self.shutdown_engine(&file_id).await {
                errors.push(format!("{}: {}", file_id, e));
            }
        }

        // Clear the map
        self.engines.clear();

        if errors.is_empty() {
            Ok(())
        } else {
            Err(format!(
                "Failed to shutdown some engines: {}",
                errors.join(", ")
            ))
        }
    }

    /// Get the number of active engines.
    pub fn count(&self) -> usize {
        self.engines.len()
    }

    /// Check if an engine exists for a file.
    pub fn has_engine(&self, file_id: &str) -> bool {
        self.engines.contains_key(file_id)
    }
}

impl Default for EngineManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::EventStore;
    use crate::models::Command;

    async fn create_test_pool() -> SqlitePool {
        EventStore::create(":memory:")
            .await
            .expect("Failed to create test pool")
    }

    #[tokio::test]
    async fn test_manager_spawn_engine() {
        let manager = EngineManager::new();
        let pool = create_test_pool().await;

        let result = manager
            .spawn_engine("test.elf".to_string(), pool)
            .await;

        assert!(result.is_ok());
        assert_eq!(manager.count(), 1);
        assert!(manager.has_engine("test.elf"));
    }

    #[tokio::test]
    async fn test_manager_spawn_duplicate_error() {
        let manager = EngineManager::new();
        let pool1 = create_test_pool().await;
        let pool2 = create_test_pool().await;

        // First spawn succeeds
        manager
            .spawn_engine("test.elf".to_string(), pool1)
            .await
            .expect("First spawn should succeed");

        // Second spawn fails
        let result = manager
            .spawn_engine("test.elf".to_string(), pool2)
            .await;

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Engine for file 'test.elf' already exists"));
        assert_eq!(manager.count(), 1);
    }

    #[tokio::test]
    async fn test_manager_get_engine() {
        let manager = EngineManager::new();
        let pool = create_test_pool().await;

        // No engine exists yet
        assert!(manager.get_engine("test.elf").is_none());

        // Spawn engine
        manager
            .spawn_engine("test.elf".to_string(), pool)
            .await
            .expect("Failed to spawn engine");

        // Now get_engine returns Some
        let handle = manager.get_engine("test.elf");
        assert!(handle.is_some());

        // Can use the handle to send commands
        let cmd = Command::new(
            "alice".to_string(),
            "core.create".to_string(),
            "block1".to_string(),
            serde_json::json!({
                "name": "Test Block",
                "block_type": "markdown"
            }),
        );

        let result = handle.unwrap().process_command(cmd).await;
        if let Err(e) = &result {
            eprintln!("Command failed: {}", e);
        }
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_manager_shutdown_engine() {
        let manager = EngineManager::new();
        let pool = create_test_pool().await;

        manager
            .spawn_engine("test.elf".to_string(), pool)
            .await
            .expect("Failed to spawn engine");

        assert_eq!(manager.count(), 1);

        // Shutdown the engine
        let result = manager.shutdown_engine("test.elf").await;
        assert!(result.is_ok());
        assert_eq!(manager.count(), 0);
        assert!(!manager.has_engine("test.elf"));
    }

    #[tokio::test]
    async fn test_manager_shutdown_nonexistent_error() {
        let manager = EngineManager::new();

        let result = manager.shutdown_engine("nonexistent.elf").await;
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("No engine found for file 'nonexistent.elf'"));
    }

    #[tokio::test]
    async fn test_manager_multiple_engines() {
        let manager = EngineManager::new();

        // Spawn multiple engines
        for i in 1..=3 {
            let pool = create_test_pool().await;
            let file_id = format!("test{}.elf", i);

            manager
                .spawn_engine(file_id, pool)
                .await
                .expect("Failed to spawn engine");
        }

        assert_eq!(manager.count(), 3);
        assert!(manager.has_engine("test1.elf"));
        assert!(manager.has_engine("test2.elf"));
        assert!(manager.has_engine("test3.elf"));

        // Each engine is independent - can process commands separately
        let handle1 = manager.get_engine("test1.elf").unwrap();
        let handle2 = manager.get_engine("test2.elf").unwrap();

        let cmd1 = Command::new(
            "alice".to_string(),
            "core.create".to_string(),
            "block1".to_string(),
            serde_json::json!({"name": "Block 1", "block_type": "markdown"}),
        );

        let cmd2 = Command::new(
            "bob".to_string(),
            "core.create".to_string(),
            "block2".to_string(),
            serde_json::json!({"name": "Block 2", "block_type": "markdown"}),
        );

        let result1 = handle1.process_command(cmd1).await;
        let result2 = handle2.process_command(cmd2).await;

        if let Err(e) = &result1 {
            eprintln!("Command 1 failed: {}", e);
        }
        if let Err(e) = &result2 {
            eprintln!("Command 2 failed: {}", e);
        }
        assert!(result1.is_ok());
        assert!(result2.is_ok());
    }

    #[tokio::test]
    async fn test_manager_shutdown_all() {
        let manager = EngineManager::new();

        // Spawn multiple engines
        for i in 1..=3 {
            let pool = create_test_pool().await;
            let file_id = format!("test{}.elf", i);

            manager
                .spawn_engine(file_id, pool)
                .await
                .expect("Failed to spawn engine");
        }

        assert_eq!(manager.count(), 3);

        // Shutdown all engines
        let result = manager.shutdown_all().await;
        assert!(result.is_ok());
        assert_eq!(manager.count(), 0);
        assert!(!manager.has_engine("test1.elf"));
        assert!(!manager.has_engine("test2.elf"));
        assert!(!manager.has_engine("test3.elf"));
    }
}
