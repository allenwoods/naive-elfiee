/// Tests for terminal.write capability with save functionality
///
/// Tests the enhanced terminal.write capability that supports both:
/// - Regular write operations (appending to history)  
/// - Save operations (storing terminal content to block contents)

use crate::extensions::terminal::terminal_write::handle_write;
use super::TerminalWritePayload;
use crate::models::{Block, Command};
use std::collections::HashMap;
use chrono::Utc;

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_block(contents: serde_json::Value) -> Block {
        Block {
            block_id: "test-terminal-block".to_string(),
            name: "Test Terminal".to_string(),
            block_type: "terminal".to_string(),
            contents,
            children: HashMap::new(),
            owner: "test-editor".to_string(),
        }
    }

    fn create_test_command(editor_id: &str, payload: TerminalWritePayload) -> Command {
        Command {
            cmd_id: "test-cmd-id".to_string(),
            editor_id: editor_id.to_string(),
            cap_id: "terminal.write".to_string(),
            block_id: "test-terminal-block".to_string(),
            payload: serde_json::to_value(payload).unwrap(),
            timestamp: Utc::now(),
        }
    }

    #[test]
    fn test_save_operation_creates_saved_content() {
        let block = create_test_block(serde_json::json!({}));
        
        let payload = TerminalWritePayload {
            data: None,
            saved_content: Some("Welcome to Terminal!\n$ ls\nfile1.txt file2.txt".to_string()),
            saved_at: Some("2024-01-15T14:30:25.123Z".to_string()),
            current_directory: Some("/home/user".to_string()),
            root_path: None,
            current_path: None,
            latest_snapshot_block_id: None, // 不再使用
        };
        
        let cmd = create_test_command("test-editor", payload);
        let result = handle_write(&cmd, Some(&block));
        
        assert!(result.is_ok());
        let events = result.unwrap();
        assert_eq!(events.len(), 1);
        
        let event = &events[0];
        assert_eq!(event.entity, "test-terminal-block");
        assert_eq!(event.attribute, "test-editor/terminal.write");
        
        let contents = event.value.get("contents")
        .expect("Event should have contents")
        .as_object()
        .expect("Contents should be an object");
        assert_eq!(
            contents.get("saved_content").unwrap().as_str().unwrap(),
            "Welcome to Terminal!\n$ ls\nfile1.txt file2.txt"
        );
        assert_eq!(
            contents.get("saved_at").unwrap().as_str().unwrap(),
            "2024-01-15T14:30:25.123Z"
        );
        assert_eq!(
            contents.get("current_directory").unwrap().as_str().unwrap(),
            "/home/user"
        );
    }

    #[test]
    fn test_save_operation_preserves_existing_contents() {
        let existing_contents = serde_json::json!({
            "history": [
                {"command": "echo test", "output": "test", "exit_code": 0}
            ],
            "some_other_field": "preserved_value"
        });
        
        let block = create_test_block(existing_contents);
        
        let payload = TerminalWritePayload {
            data: None,
            saved_content: Some("Terminal content".to_string()),
            saved_at: Some("2024-01-15T14:30:25.123Z".to_string()),
            current_directory: Some("/test".to_string()),
            root_path: None,
            current_path: None,
            latest_snapshot_block_id: None, // 不再使用
        };
        
        let cmd = create_test_command("test-editor", payload);
        let result = handle_write(&cmd, Some(&block));
        
        assert!(result.is_ok());
        let events = result.unwrap();
        let contents = events[0].value.get("contents").unwrap().as_object().unwrap();
        
        // Should preserve existing fields
        assert!(contents.contains_key("history"));
        assert_eq!(
            contents.get("some_other_field").unwrap().as_str().unwrap(),
            "preserved_value"
        );
        
        // Should add new save fields
        assert_eq!(
            contents.get("saved_content").unwrap().as_str().unwrap(),
            "Terminal content"
        );
    }

    #[test]
    fn test_save_operation_overwrites_previous_save() {
        let existing_contents = serde_json::json!({
            "saved_content": "Old content",
            "saved_at": "2024-01-01T00:00:00.000Z",
            "current_directory": "/old"
        });
        
        let block = create_test_block(existing_contents);
        
        let payload = TerminalWritePayload {
            data: None,
            saved_content: Some("New content".to_string()),
            saved_at: Some("2024-01-15T14:30:25.123Z".to_string()),
            current_directory: Some("/new".to_string()),
            root_path: None,
            current_path: None,
            latest_snapshot_block_id: None, // 不再使用
        };
        
        let cmd = create_test_command("test-editor", payload);
        let result = handle_write(&cmd, Some(&block));
        
        assert!(result.is_ok());
        let events = result.unwrap();
        let contents = events[0].value.get("contents").unwrap().as_object().unwrap();
        
        // Should overwrite with new values
        assert_eq!(
            contents.get("saved_content").unwrap().as_str().unwrap(),
            "New content"
        );
        assert_eq!(
            contents.get("saved_at").unwrap().as_str().unwrap(),
            "2024-01-15T14:30:25.123Z"
        );
        assert_eq!(
            contents.get("current_directory").unwrap().as_str().unwrap(),
            "/new"
        );
    }

    #[test]
    fn test_regular_write_operation_appends_to_history() {
        let existing_contents = serde_json::json!({
            "history": [
                {"command": "echo test", "output": "test", "exit_code": 0}
            ]
        });
        
        let block = create_test_block(existing_contents);
        
        let payload = TerminalWritePayload {
            data: Some(serde_json::json!("This is a test message")),
            saved_content: None,
            saved_at: None,
            current_directory: None,
            root_path: None,
            current_path: None,
            latest_snapshot_block_id: None, // 不再使用
        };
        
        let cmd = create_test_command("test-editor", payload);
        let result = handle_write(&cmd, Some(&block));
        
        assert!(result.is_ok());
        let events = result.unwrap();
        let contents = events[0].value.get("contents").unwrap().as_object().unwrap();
        
        let history = contents.get("history").unwrap().as_array().unwrap();
        assert_eq!(history.len(), 2); // Original + new entry
        
        let new_entry = &history[1];
        assert_eq!(new_entry.get("command").unwrap().as_str().unwrap(), "");
        assert_eq!(new_entry.get("output").unwrap().as_str().unwrap(), "This is a test message");
        assert_eq!(new_entry.get("exit_code").unwrap().as_i64().unwrap(), 0);
        assert_eq!(new_entry.get("type").unwrap().as_str().unwrap(), "write");
    }

    #[test]
    fn test_regular_write_with_json_data() {
        let block = create_test_block(serde_json::json!({}));
        
        let payload = TerminalWritePayload {
            data: Some(serde_json::json!({"message": "complex data", "code": 42})),
            saved_content: None,
            saved_at: None,
            current_directory: None,
            root_path: None,
            current_path: None,
            latest_snapshot_block_id: None, // 不再使用
        };
        
        let cmd = create_test_command("test-editor", payload);
        let result = handle_write(&cmd, Some(&block));
        
        assert!(result.is_ok());
        let events = result.unwrap();
        let contents = events[0].value.get("contents").unwrap().as_object().unwrap();
        
        let history = contents.get("history").unwrap().as_array().unwrap();
        assert_eq!(history.len(), 1);
        
        let entry = &history[0];
        let output = entry.get("output").unwrap().as_str().unwrap();
        // JSON objects should be converted to string
        assert!(output.contains("complex data"));
        assert!(output.contains("42"));
    }

    #[test]
    fn test_save_operation_with_partial_fields() {
        let block = create_test_block(serde_json::json!({}));
        
        let payload = TerminalWritePayload {
            data: None,
            saved_content: Some("Content only".to_string()),
            saved_at: None, // Missing timestamp
            current_directory: None, // Missing directory
            root_path: None,
            current_path: None,
            latest_snapshot_block_id: None, // 不再使用
        };
        
        let cmd = create_test_command("test-editor", payload);
        let result = handle_write(&cmd, Some(&block));
        
        assert!(result.is_ok());
        let events = result.unwrap();
        let contents = events[0].value.get("contents").unwrap().as_object().unwrap();
        
        // Should save the provided content
        assert_eq!(
            contents.get("saved_content").unwrap().as_str().unwrap(),
            "Content only"
        );
        
        // Should not have missing fields
        assert!(!contents.contains_key("saved_at"));
        assert!(!contents.contains_key("current_directory"));
    }

    // 注意：移除 latest_snapshot_block_id 相关测试，因为新需求不再创建 Markdown Block
    // #[test] - REMOVED: test_no_error_when_only_latest_snapshot_block_id_provided

    #[test]
    fn test_error_when_no_block_provided() {
        let payload = TerminalWritePayload {
            data: Some(serde_json::json!("test")),
            saved_content: None,
            saved_at: None,
            current_directory: None,
            root_path: None,
            current_path: None,
            latest_snapshot_block_id: None, // 不再使用
        };
        
        let cmd = create_test_command("test-editor", payload);
        let result = handle_write(&cmd, None);
        
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error, "Block required for terminal.write");
    }

    #[test]
    fn test_save_operation_with_multiline_content() {
        let block = create_test_block(serde_json::json!({}));
        
        let multiline_content = r#"Welcome to Elfiee Terminal!
Current directory: .
Type any command to execute.
. $ ls
file1.txt  file2.txt
. $ echo "Hello World"
Hello World
. $ pwd
/home/user"#;
        
        let payload = TerminalWritePayload {
            data: None,
            saved_content: Some(multiline_content.to_string()),
            saved_at: Some("2024-01-15T14:30:25.123Z".to_string()),
            current_directory: Some("/home/user".to_string()),
            root_path: None,
            current_path: None,
            latest_snapshot_block_id: None, // 不再使用
        };
        
        let cmd = create_test_command("test-editor", payload);
        let result = handle_write(&cmd, Some(&block));
        
        assert!(result.is_ok());
        let events = result.unwrap();
        let contents = events[0].value.get("contents").unwrap().as_object().unwrap();
        
        let saved_content = contents.get("saved_content").unwrap().as_str().unwrap();
        assert_eq!(saved_content, multiline_content);
        
        // Verify it contains expected terminal elements
        assert!(saved_content.contains("Welcome to Elfiee Terminal!"));
        assert!(saved_content.contains("$ ls"));
        assert!(saved_content.contains("file1.txt  file2.txt"));
        assert!(saved_content.contains("Hello World"));
    }

    #[test]
    fn test_save_operation_creates_correct_event_structure() {
        let block = create_test_block(serde_json::json!({}));
        
        let payload = TerminalWritePayload {
            data: None,
            saved_content: Some("Test content".to_string()),
            saved_at: Some("2024-01-15T14:30:25.123Z".to_string()),
            current_directory: Some("/test".to_string()),
            root_path: None,
            current_path: None,
            latest_snapshot_block_id: None, // 不再使用
        };
        
        let cmd = create_test_command("test-editor", payload);
        let result = handle_write(&cmd, Some(&block));
        
        assert!(result.is_ok());
        let events = result.unwrap();
        assert_eq!(events.len(), 1);
        
        let event = &events[0];
        
        // Verify event structure
        assert_eq!(event.entity, "test-terminal-block");
        assert_eq!(event.attribute, "test-editor/terminal.write");
        assert!(event.value.get("contents").is_some());
        assert!(event.event_id.len() > 0);
        
        // Event should be properly formatted for event store
        assert!(event.value.is_object());
    }

    #[test]
    fn test_new_fields_are_saved_correctly() {
        let block = create_test_block(serde_json::json!({}));
        
        let payload = TerminalWritePayload {
            data: None,
            saved_content: Some("Test content".to_string()),
            saved_at: Some("2024-01-15T14:30:25.123Z".to_string()),
            current_directory: Some("/test".to_string()),
            root_path: Some("/root/path".to_string()),
            current_path: Some("/current/path".to_string()),
            latest_snapshot_block_id: None, // 不再使用 // 不再使用 latest_snapshot_block_id
        };
        
        let cmd = create_test_command("test-editor", payload);
        let result = handle_write(&cmd, Some(&block));
        
        assert!(result.is_ok());
        let events = result.unwrap();
        let contents = events[0].value.get("contents").unwrap().as_object().unwrap();
        
        // Verify all new fields are saved
        assert_eq!(
            contents.get("root_path").unwrap().as_str().unwrap(),
            "/root/path"
        );
        assert_eq!(
            contents.get("current_path").unwrap().as_str().unwrap(),
            "/current/path"
        );
        
        // 注意：不再检查 latest_snapshot_block_id，因为新需求不再创建 Markdown Block
        
        // Verify original fields are still saved
        assert_eq!(
            contents.get("saved_content").unwrap().as_str().unwrap(),
            "Test content"
        );
        assert_eq!(
            contents.get("current_directory").unwrap().as_str().unwrap(),
            "/test"
        );
    }
}