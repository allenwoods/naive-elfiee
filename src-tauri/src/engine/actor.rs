use crate::capabilities::registry::CapabilityRegistry;
use crate::engine::event_store::EventStore;
use crate::engine::state::StateProjector;
use crate::models::{Block, Command, Editor, Event};
use sqlx::SqlitePool;
use std::collections::HashMap;
use tokio::sync::{mpsc, oneshot};

/// Messages that can be sent to the engine actor.
#[derive(Debug)]
pub enum EngineMessage {
    /// Process a command and return resulting events
    ProcessCommand {
        command: Command,
        response: oneshot::Sender<Result<Vec<Event>, String>>,
    },
    /// Get a block by ID
    GetBlock {
        block_id: String,
        response: oneshot::Sender<Option<Block>>,
    },
    /// Get all blocks
    GetAllBlocks {
        response: oneshot::Sender<HashMap<String, Block>>,
    },
    /// Get all editors
    GetAllEditors {
        response: oneshot::Sender<HashMap<String, Editor>>,
    },
    /// Shutdown the actor
    Shutdown,
}

/// Actor that processes commands for a single .elf file.
///
/// Each file has its own engine actor, ensuring serial processing of commands
/// for that file. This prevents race conditions and maintains consistency.
pub struct ElfileEngineActor {
    /// Unique identifier for this file
    #[allow(dead_code)]
    file_id: String,

    /// SQLite connection pool for event persistence
    event_pool: SqlitePool,

    /// Current state projection
    state: StateProjector,

    /// Capability registry
    registry: CapabilityRegistry,

    /// Mailbox for receiving messages
    mailbox: mpsc::UnboundedReceiver<EngineMessage>,
}

impl ElfileEngineActor {
    /// Create a new engine actor for a file.
    ///
    /// This initializes the actor by replaying all events from the database
    /// to rebuild the current state.
    pub async fn new(
        file_id: String,
        event_pool: SqlitePool,
        mailbox: mpsc::UnboundedReceiver<EngineMessage>,
    ) -> Result<Self, String> {
        let registry = CapabilityRegistry::new();
        let mut state = StateProjector::new();

        // Replay all events from database to rebuild state
        let events = EventStore::get_all_events(&event_pool)
            .await
            .map_err(|e| format!("Failed to load events from database: {}", e))?;
        state.replay(events);

        Ok(Self {
            file_id,
            event_pool,
            state,
            registry,
            mailbox,
        })
    }

    /// Run the actor's main loop.
    ///
    /// This processes messages from the mailbox until a Shutdown message is received.
    pub async fn run(mut self) {
        while let Some(msg) = self.mailbox.recv().await {
            match msg {
                EngineMessage::ProcessCommand { command, response } => {
                    let result = self.process_command(command).await;
                    let _ = response.send(result);
                }
                EngineMessage::GetBlock { block_id, response } => {
                    let block = self.state.get_block(&block_id).cloned();
                    let _ = response.send(block);
                }
                EngineMessage::GetAllBlocks { response } => {
                    let blocks = self.state.blocks.clone();
                    let _ = response.send(blocks);
                }
                EngineMessage::GetAllEditors { response } => {
                    let editors = self.state.editors.clone();
                    let _ = response.send(editors);
                }
                EngineMessage::Shutdown => {
                    break;
                }
            }
        }
    }

    /// Process a command and return resulting events.
    ///
    /// This is the core command processing logic:
    /// 1. Get capability handler
    /// 2. Get block (None for create, Some for others)
    /// 3. Check authorization (certificator)
    /// 4. Execute handler
    /// 5. Update vector clock
    /// 6. Check for conflicts (MVP simple version)
    /// 7. Commit events to EventStore
    /// 8. Apply events to StateProjector
    async fn process_command(&mut self, cmd: Command) -> Result<Vec<Event>, String> {
        // 1. Get capability handler
        let handler = self
            .registry
            .get(&cmd.cap_id)
            .ok_or_else(|| format!("Unknown capability: {}", cmd.cap_id))?;

        // 2. Get block (None for create operations, Some for others)
        // System-level operations like core.create and editor.create don't require a block
        let block_opt = if cmd.cap_id == "core.create" || cmd.cap_id == "editor.create" {
            None
        } else {
            Some(
                self.state
                    .get_block(&cmd.block_id)
                    .ok_or_else(|| format!("Block not found: {}", cmd.block_id))?,
            )
        };

        // 3. Check authorization (certificator)
        // Only check if block exists (non-create operations)
        if let Some(block) = block_opt {
            let is_authorized = block.owner == cmd.editor_id
                || self
                    .state
                    .grants
                    .has_grant(&cmd.editor_id, &cmd.cap_id, &block.block_id);

            if !is_authorized {
                return Err(format!(
                    "Authorization failed: {} does not have permission for {} on block {}",
                    cmd.editor_id, cmd.cap_id, cmd.block_id
                ));
            }
        }

        // 4. Execute handler
        let mut events = handler.handler(&cmd, block_opt)?;

        // 5. Update vector clock
        let current_count = self.state.get_editor_count(&cmd.editor_id);
        let new_count = current_count + 1;

        for event in &mut events {
            event.timestamp.insert(cmd.editor_id.clone(), new_count);
        }

        // 6. Check for conflicts (MVP simple version)
        // For MVP, we just log if there's a potential conflict but don't reject
        // In production, this would trigger merge/resolution logic
        if self.state.has_conflict(&cmd.editor_id, current_count) {
            eprintln!(
                "Warning: Potential conflict detected for editor {} (expected: {}, current: {})",
                cmd.editor_id,
                current_count,
                self.state.get_editor_count(&cmd.editor_id)
            );
        }

        // 7. Persist events to database
        EventStore::append_events(&self.event_pool, &events)
            .await
            .map_err(|e| format!("Failed to persist events to database: {}", e))?;

        // 8. Apply events to StateProjector
        for event in &events {
            self.state.apply_event(event);
        }

        Ok(events)
    }
}

/// Handle for interacting with an engine actor.
///
/// This provides an async API for sending messages to the actor.
#[derive(Clone, Debug)]
pub struct EngineHandle {
    sender: mpsc::UnboundedSender<EngineMessage>,
}

impl EngineHandle {
    /// Create a new handle with the given sender.
    pub fn new(sender: mpsc::UnboundedSender<EngineMessage>) -> Self {
        Self { sender }
    }

    /// Process a command and return resulting events.
    pub async fn process_command(&self, command: Command) -> Result<Vec<Event>, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(EngineMessage::ProcessCommand {
                command,
                response: tx,
            })
            .map_err(|_| "Engine actor has shut down".to_string())?;

        rx.await
            .map_err(|_| "Engine actor did not respond".to_string())?
    }

    /// Get a block by ID.
    pub async fn get_block(&self, block_id: String) -> Option<Block> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(EngineMessage::GetBlock {
                block_id,
                response: tx,
            })
            .ok()?;

        rx.await.ok()?
    }

    /// Get all blocks.
    pub async fn get_all_blocks(&self) -> HashMap<String, Block> {
        let (tx, rx) = oneshot::channel();
        if self
            .sender
            .send(EngineMessage::GetAllBlocks { response: tx })
            .is_err()
        {
            return HashMap::new();
        }

        rx.await.unwrap_or_default()
    }

    /// Get all editors.
    pub async fn get_all_editors(&self) -> HashMap<String, Editor> {
        let (tx, rx) = oneshot::channel();
        if self
            .sender
            .send(EngineMessage::GetAllEditors { response: tx })
            .is_err()
        {
            return HashMap::new();
        }

        rx.await.unwrap_or_default()
    }

    /// Shutdown the engine actor.
    pub async fn shutdown(&self) {
        let _ = self.sender.send(EngineMessage::Shutdown);
    }
}

/// Spawn a new engine actor for a file.
///
/// Returns a handle for interacting with the actor.
pub async fn spawn_engine(file_id: String, event_pool: SqlitePool) -> Result<EngineHandle, String> {
    let (tx, rx) = mpsc::unbounded_channel();

    let actor = ElfileEngineActor::new(file_id.clone(), event_pool, rx).await?;

    // Spawn the actor on tokio runtime
    tokio::spawn(async move {
        actor.run().await;
    });

    Ok(EngineHandle::new(tx))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_engine_actor_creation() {
        let event_pool = EventStore::create(":memory:").await.unwrap();
        let handle = spawn_engine("test_file".to_string(), event_pool)
            .await
            .expect("Failed to spawn engine");

        // Test that we can get all blocks (should be empty initially)
        let blocks = handle.get_all_blocks().await;
        assert_eq!(blocks.len(), 0);

        handle.shutdown().await;
    }

    #[tokio::test]
    async fn test_engine_create_block() {
        let event_pool = EventStore::create(":memory:").await.unwrap();
        let handle = spawn_engine("test_file".to_string(), event_pool.clone())
            .await
            .expect("Failed to spawn engine");

        // Create a block
        let cmd = Command::new(
            "alice".to_string(),
            "core.create".to_string(),
            "".to_string(),
            serde_json::json!({
                "name": "Test Block",
                "block_type": "markdown"
            }),
        );

        let events = handle
            .process_command(cmd)
            .await
            .expect("Failed to create block");

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].attribute, "alice/core.create");

        // Verify block was created
        let blocks = handle.get_all_blocks().await;
        assert_eq!(blocks.len(), 1);

        handle.shutdown().await;
    }

    #[tokio::test]
    async fn test_engine_authorization_owner() {
        let event_pool = EventStore::create(":memory:").await.unwrap();
        let handle = spawn_engine("test_file".to_string(), event_pool.clone())
            .await
            .expect("Failed to spawn engine");

        // Create a block owned by alice
        let create_cmd = Command::new(
            "alice".to_string(),
            "core.create".to_string(),
            "".to_string(),
            serde_json::json!({
                "name": "Alice's Block",
                "block_type": "markdown"
            }),
        );

        let create_events = handle
            .process_command(create_cmd)
            .await
            .expect("Failed to create block");
        let block_id = &create_events[0].entity;

        // Alice (owner) should be able to link
        let link_cmd = Command::new(
            "alice".to_string(),
            "core.link".to_string(),
            block_id.clone(),
            serde_json::json!({
                "relation": "references",
                "target_id": "other_block"
            }),
        );

        let result = handle.process_command(link_cmd).await;
        assert!(result.is_ok(), "Owner should be authorized");

        handle.shutdown().await;
    }

    #[tokio::test]
    async fn test_engine_authorization_non_owner_rejected() {
        let event_pool = EventStore::create(":memory:").await.unwrap();
        let handle = spawn_engine("test_file".to_string(), event_pool.clone())
            .await
            .expect("Failed to spawn engine");

        // Create a block owned by alice
        let create_cmd = Command::new(
            "alice".to_string(),
            "core.create".to_string(),
            "".to_string(),
            serde_json::json!({
                "name": "Alice's Block",
                "block_type": "markdown"
            }),
        );

        let create_events = handle
            .process_command(create_cmd)
            .await
            .expect("Failed to create block");
        let block_id = &create_events[0].entity;

        // Bob (non-owner) should NOT be able to link without grant
        let link_cmd = Command::new(
            "bob".to_string(),
            "core.link".to_string(),
            block_id.clone(),
            serde_json::json!({
                "relation": "references",
                "target_id": "other_block"
            }),
        );

        let result = handle.process_command(link_cmd).await;
        assert!(result.is_err(), "Non-owner should be rejected");
        assert!(result.unwrap_err().contains("Authorization failed"));

        handle.shutdown().await;
    }

    #[tokio::test]
    async fn test_engine_authorization_with_grant() {
        let event_pool = EventStore::create(":memory:").await.unwrap();
        let handle = spawn_engine("test_file".to_string(), event_pool.clone())
            .await
            .expect("Failed to spawn engine");

        // Create a block owned by alice
        let create_cmd = Command::new(
            "alice".to_string(),
            "core.create".to_string(),
            "".to_string(),
            serde_json::json!({
                "name": "Alice's Block",
                "block_type": "markdown"
            }),
        );

        let create_events = handle
            .process_command(create_cmd)
            .await
            .expect("Failed to create block");
        let block_id = &create_events[0].entity;

        // Alice grants bob permission
        let grant_cmd = Command::new(
            "alice".to_string(),
            "core.grant".to_string(),
            block_id.clone(),
            serde_json::json!({
                "target_editor": "bob",
                "capability": "core.link",
                "target_block": block_id
            }),
        );

        handle
            .process_command(grant_cmd)
            .await
            .expect("Failed to grant permission");

        // Bob should now be able to link
        let link_cmd = Command::new(
            "bob".to_string(),
            "core.link".to_string(),
            block_id.clone(),
            serde_json::json!({
                "relation": "references",
                "target_id": "other_block"
            }),
        );

        let result = handle.process_command(link_cmd).await;
        assert!(result.is_ok(), "User with grant should be authorized");

        handle.shutdown().await;
    }

    #[tokio::test]
    async fn test_engine_vector_clock_updates() {
        let event_pool = EventStore::create(":memory:").await.unwrap();
        let handle = spawn_engine("test_file".to_string(), event_pool.clone())
            .await
            .expect("Failed to spawn engine");

        // Create first block
        let cmd1 = Command::new(
            "alice".to_string(),
            "core.create".to_string(),
            "".to_string(),
            serde_json::json!({
                "name": "Block 1",
                "block_type": "markdown"
            }),
        );

        let events1 = handle
            .process_command(cmd1)
            .await
            .expect("Failed to create block 1");

        // Create second block
        let cmd2 = Command::new(
            "alice".to_string(),
            "core.create".to_string(),
            "".to_string(),
            serde_json::json!({
                "name": "Block 2",
                "block_type": "markdown"
            }),
        );

        let events2 = handle
            .process_command(cmd2)
            .await
            .expect("Failed to create block 2");

        // Verify vector clock incremented
        assert_eq!(events1[0].timestamp.get("alice"), Some(&1));
        assert_eq!(events2[0].timestamp.get("alice"), Some(&2));

        handle.shutdown().await;
    }

    #[tokio::test]
    async fn test_engine_get_block() {
        let event_pool = EventStore::create(":memory:").await.unwrap();
        let handle = spawn_engine("test_file".to_string(), event_pool.clone())
            .await
            .expect("Failed to spawn engine");

        // Create a block
        let create_cmd = Command::new(
            "alice".to_string(),
            "core.create".to_string(),
            "".to_string(),
            serde_json::json!({
                "name": "Test Block",
                "block_type": "markdown"
            }),
        );

        let events = handle
            .process_command(create_cmd)
            .await
            .expect("Failed to create block");
        let block_id = &events[0].entity;

        // Get the block
        let block = handle
            .get_block(block_id.clone())
            .await
            .expect("Block should exist");

        assert_eq!(block.name, "Test Block");
        assert_eq!(block.block_type, "markdown");
        assert_eq!(block.owner, "alice");

        handle.shutdown().await;
    }
}
