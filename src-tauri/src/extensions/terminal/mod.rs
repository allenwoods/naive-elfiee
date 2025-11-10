use serde::{Deserialize, Serialize};
use specta::Type;

/// Payload for terminal.execute capability
///
/// This payload is used to execute a terminal command and record it in the terminal block's history.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TerminalExecutePayload {
    /// The command to execute
    pub command: String,
}

pub mod terminal_execute;

/// Terminal extension for Elfiee.
///
/// This extension provides capabilities for executing terminal commands and recording them
/// in blocks of type "terminal".
///
/// ## Capabilities
///
/// - `terminal.execute`: Execute a terminal command and record it in the terminal block's history
///
/// ## Payload Types
///
/// - `TerminalExecutePayload`: Contains a single `command` field with the command string
///
/// ## Usage Example
///
/// ```rust,ignore
/// use elfiee::models::{Block, Command};
/// use elfiee::capabilities::CapabilityRegistry;
/// use elfiee::extensions::terminal::TerminalExecutePayload;
///
/// // Create a terminal block
/// let mut block = Block::new(
///     "Terminal".to_string(),
///     "terminal".to_string(),
///     "alice".to_string(),
/// );
/// block.contents = serde_json::json!({ "history": [] });
///
/// // Execute a terminal command
/// let cmd = Command::new(
///     "alice".to_string(),
///     "terminal.execute".to_string(),
///     block.block_id.clone(),
///     serde_json::json!({ "command": "echo hello" }),
/// );
/// ```

// Re-export capabilities for registration
pub use terminal_execute::*;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::capabilities::grants::GrantsTable;
    use crate::capabilities::CapabilityRegistry;
    use crate::models::{Block, Command};
    use std::fs;
    use std::path::PathBuf;
    use tempfile::tempdir;

    #[test]
    fn test_terminal_execute_payload_deserialize() {
        let json = serde_json::json!({ "command": "echo hello" });
        let payload: TerminalExecutePayload = serde_json::from_value(json).unwrap();
        assert_eq!(payload.command, "echo hello");
    }

    #[test]
    fn test_terminal_execute_payload_missing_command() {
        let json = serde_json::json!({});
        let result: Result<TerminalExecutePayload, _> = serde_json::from_value(json);
        assert!(result.is_err(), "Should reject missing command field");
    }

    #[test]
    fn test_terminal_execute_capability() {
        let registry = CapabilityRegistry::new();
        let cap = registry
            .get("terminal.execute")
            .expect("terminal.execute should be registered");

        let mut block = Block::new(
            "Terminal".to_string(),
            "terminal".to_string(),
            "alice".to_string(),
        );
        block.contents = serde_json::json!({ "history": [] });

        let cmd = Command::new(
            "alice".to_string(),
            "terminal.execute".to_string(),
            block.block_id.clone(),
            serde_json::json!({
                "command": "echo hello"
            }),
        );

        let events = cap.handler(&cmd, Some(&block)).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].entity, block.block_id);
        assert_eq!(events[0].attribute, "alice/terminal.execute");

        // Verify history was updated
        let contents = events[0].value.get("contents").unwrap();
        let history = contents.get("history").unwrap().as_array().unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].get("command").unwrap().as_str().unwrap(), "echo hello");
        assert_eq!(history[0].get("output").unwrap().as_str().unwrap(), "hello");
    }

    #[test]
    fn test_terminal_execute_updates_history() {
        let registry = CapabilityRegistry::new();
        let cap = registry.get("terminal.execute").unwrap();

        let mut block = Block::new(
            "Terminal".to_string(),
            "terminal".to_string(),
            "alice".to_string(),
        );
        block.contents = serde_json::json!({
            "history": [
                {
                    "command": "ls",
                    "output": "file1.txt\nfile2.txt",
                    "timestamp": "2025-01-01T00:00:00Z",
                    "exit_code": 0
                }
            ]
        });

        let cmd = Command::new(
            "alice".to_string(),
            "terminal.execute".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "command": "pwd" }),
        );

        let events = cap.handler(&cmd, Some(&block)).unwrap();
        let contents = events[0].value.get("contents").unwrap();
        let history = contents.get("history").unwrap().as_array().unwrap();
        assert_eq!(history.len(), 2, "History should have 2 entries");
        assert_eq!(history[0].get("command").unwrap().as_str().unwrap(), "ls");
        assert_eq!(history[1].get("command").unwrap().as_str().unwrap(), "pwd");
    }

    #[test]
    fn test_terminal_execute_cd_virtual_command() {
        let registry = CapabilityRegistry::new();
        let cap = registry.get("terminal.execute").unwrap();

        let temp_dir = tempdir().unwrap();
        let target_subdir = temp_dir.path().join("sub");
        fs::create_dir_all(&target_subdir).unwrap();

        let mut block = Block::new(
            "Terminal".to_string(),
            "terminal".to_string(),
            "alice".to_string(),
        );
        block.contents = serde_json::json!({
            "history": [],
            "root_path": temp_dir.path().to_string_lossy(),
            "current_path": temp_dir.path().to_string_lossy(),
            "current_directory": "."
        });

        let cmd = Command::new(
            "alice".to_string(),
            "terminal.execute".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "command": "cd sub" }),
        );

        let events = cap.handler(&cmd, Some(&block)).unwrap();
        let contents = events[0].value.get("contents").unwrap();
        let history = contents.get("history").unwrap().as_array().unwrap();

        assert_eq!(history.len(), 1);
        assert_eq!(
            history[0].get("exit_code").and_then(|v| v.as_i64()),
            Some(0),
            "cd should not fail"
        );
        let stored_path = contents
            .get("current_path")
            .and_then(|v| v.as_str())
            .unwrap();
        assert_eq!(
            PathBuf::from(stored_path),
            target_subdir.canonicalize().unwrap()
        );
        assert_eq!(
            contents
                .get("current_directory")
                .and_then(|v| v.as_str())
                .unwrap(),
            "sub"
        );
    }

    #[test]
    fn test_terminal_execute_pwd_virtual_command() {
        let registry = CapabilityRegistry::new();
        let cap = registry.get("terminal.execute").unwrap();

        let temp_dir = tempdir().unwrap();
        let target_subdir = temp_dir.path().join("nested");
        fs::create_dir_all(&target_subdir).unwrap();

        let mut block = Block::new(
            "Terminal".to_string(),
            "terminal".to_string(),
            "alice".to_string(),
        );
        block.contents = serde_json::json!({
            "history": [],
            "root_path": temp_dir.path().to_string_lossy(),
            "current_path": target_subdir.to_string_lossy(),
            "current_directory": "nested"
        });

        let cmd = Command::new(
            "alice".to_string(),
            "terminal.execute".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "command": "pwd" }),
        );

        let events = cap.handler(&cmd, Some(&block)).unwrap();
        let contents = events[0].value.get("contents").unwrap();
        let history = contents.get("history").unwrap().as_array().unwrap();

        assert_eq!(history.len(), 1);
        let pwd_output = history[0].get("output").and_then(|v| v.as_str()).unwrap();
        assert_eq!(PathBuf::from(pwd_output), target_subdir.canonicalize().unwrap());
        assert_eq!(
            history[0].get("exit_code").and_then(|v| v.as_i64()),
            Some(0)
        );
    }

    #[test]
    fn test_terminal_execute_preserves_existing_contents() {
        let registry = CapabilityRegistry::new();
        let cap = registry.get("terminal.execute").unwrap();

        let mut block = Block::new(
            "Terminal".to_string(),
            "terminal".to_string(),
            "alice".to_string(),
        );
        block.contents = serde_json::json!({
            "history": [],
            "other_field": "preserved"
        });

        let cmd = Command::new(
            "alice".to_string(),
            "terminal.execute".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "command": "echo test" }),
        );

        let events = cap.handler(&cmd, Some(&block)).unwrap();
        let contents = events[0].value.get("contents").unwrap();

        // Verify other field is preserved
        assert_eq!(
            contents.get("other_field").unwrap().as_str().unwrap(),
            "preserved"
        );
        // Verify history was updated
        assert!(contents.get("history").is_some());
    }

    #[test]
    fn test_terminal_execute_empty_history() {
        let registry = CapabilityRegistry::new();
        let cap = registry.get("terminal.execute").unwrap();

        let block = Block::new(
            "Terminal".to_string(),
            "terminal".to_string(),
            "alice".to_string(),
        );

        let cmd = Command::new(
            "alice".to_string(),
            "terminal.execute".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "command": "echo hello" }),
        );

        let events = cap.handler(&cmd, Some(&block)).unwrap();
        let contents = events[0].value.get("contents").unwrap();
        let history = contents.get("history").unwrap().as_array().unwrap();
        assert_eq!(history.len(), 1);
    }

    #[test]
    fn test_terminal_execute_multiple_commands() {
        let registry = CapabilityRegistry::new();
        let cap = registry.get("terminal.execute").unwrap();

        let mut block = Block::new(
            "Terminal".to_string(),
            "terminal".to_string(),
            "alice".to_string(),
        );
        block.contents = serde_json::json!({ "history": [] });

        // Execute first command
        let cmd1 = Command::new(
            "alice".to_string(),
            "terminal.execute".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "command": "echo hello" }),
        );
        let events1 = cap.handler(&cmd1, Some(&block)).unwrap();
        
        // Update block with first command result
        let contents1 = events1[0].value.get("contents").unwrap();
        block.contents = contents1.clone();

        // Execute second command
        let cmd2 = Command::new(
            "alice".to_string(),
            "terminal.execute".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "command": "ls" }),
        );
        let events2 = cap.handler(&cmd2, Some(&block)).unwrap();
        let contents2 = events2[0].value.get("contents").unwrap();
        let history = contents2.get("history").unwrap().as_array().unwrap();
        assert_eq!(history.len(), 2);
    }

    #[test]
    fn test_terminal_execute_authorization_owner() {
        let grants_table = GrantsTable::new();
        let block = Block::new(
            "Terminal".to_string(),
            "terminal".to_string(),
            "alice".to_string(),
        );

        let cmd = Command::new(
            "alice".to_string(),
            "terminal.execute".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "command": "echo hello" }),
        );

        let is_authorized = block.owner == cmd.editor_id
            || grants_table.has_grant(&cmd.editor_id, "terminal.execute", &block.block_id);
        assert!(is_authorized, "Owner should be authorized");
    }

    #[test]
    fn test_terminal_execute_authorization_non_owner_without_grant() {
        let grants_table = GrantsTable::new();
        let block = Block::new(
            "Terminal".to_string(),
            "terminal".to_string(),
            "alice".to_string(),
        );

        let cmd = Command::new(
            "bob".to_string(),
            "terminal.execute".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "command": "echo hello" }),
        );

        let is_authorized = block.owner == cmd.editor_id
            || grants_table.has_grant(&cmd.editor_id, "terminal.execute", &block.block_id);
        assert!(
            !is_authorized,
            "Non-owner without grant should not be authorized"
        );
    }

    #[test]
    fn test_terminal_execute_authorization_non_owner_with_grant() {
        let mut grants_table = GrantsTable::new();
        let registry = CapabilityRegistry::new();
        let block = Block::new(
            "Terminal".to_string(),
            "terminal".to_string(),
            "alice".to_string(),
        );

        // Grant bob permission to execute
        grants_table.add_grant(
            "bob".to_string(),
            "terminal.execute".to_string(),
            block.block_id.clone(),
        );

        let cmd = Command::new(
            "bob".to_string(),
            "terminal.execute".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "command": "echo hello" }),
        );

        let is_authorized = block.owner == cmd.editor_id
            || grants_table.has_grant(&cmd.editor_id, "terminal.execute", &block.block_id);
        assert!(is_authorized, "Non-owner with grant should be authorized");

        // Execute
        let cap = registry.get("terminal.execute").unwrap();
        assert!(cap.handler(&cmd, Some(&block)).is_ok());
    }
}

