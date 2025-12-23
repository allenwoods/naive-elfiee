use crate::capabilities::core::{create_event, CapResult};
use crate::models::{Block, Command, EditorCreatePayload, Event};
use capability_macros::capability;

/// Handler for editor.create capability.
///
/// Creates a new editor identity in the file.
/// This is a system-level operation that doesn't require a target block.
/// Any editor can create a new editor (no authorization check needed).
#[capability(id = "editor.create", target = "system")]
fn handle_editor_create(cmd: &Command, _block: Option<&Block>) -> CapResult<Vec<Event>> {
    // Strongly-typed deserialization
    let payload: EditorCreatePayload = serde_json::from_value(cmd.payload.clone())
        .map_err(|e| format!("Invalid payload for editor.create: {}", e))?;

    // Generate new editor ID
    let editor_id = uuid::Uuid::new_v4().to_string();

    // Determine editor_type (default to "Human" if not specified)
    let editor_type = payload.editor_type.unwrap_or_else(|| "Human".to_string());

    // Create event with full editor data
    // Entity is the new editor_id
    let event = create_event(
        editor_id.clone(),
        "editor.create",
        serde_json::json!({
            "editor_id": editor_id,
            "name": payload.name,
            "editor_type": editor_type
        }),
        &cmd.editor_id,
        1, // Placeholder - engine actor updates with correct count (actor.rs:227)
    );

    Ok(vec![event])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_command(name: &str, editor_type: Option<String>) -> Command {
        let mut payload = serde_json::json!({ "name": name });
        if let Some(et) = editor_type {
            payload["editor_type"] = serde_json::json!(et);
        }

        Command {
            cmd_id: uuid::Uuid::new_v4().to_string(),
            editor_id: "test-editor".to_string(),
            cap_id: "editor.create".to_string(),
            block_id: "system".to_string(),
            payload,
            timestamp: chrono::Utc::now(),
        }
    }

    #[test]
    fn test_editor_create_with_human_type() {
        let cmd = create_test_command("Alice", Some("Human".to_string()));
        let result = handle_editor_create(&cmd, None);

        assert!(result.is_ok());
        let events = result.unwrap();
        assert_eq!(events.len(), 1);

        let event = &events[0];
        assert_eq!(event.attribute, "test-editor/editor.create");

        // Verify event value contains correct data
        let value = &event.value;
        assert_eq!(value["name"], "Alice");
        assert_eq!(value["editor_type"], "Human");
        assert!(value["editor_id"].is_string());
    }

    #[test]
    fn test_editor_create_with_bot_type() {
        let cmd = create_test_command("CodeReviewer", Some("Bot".to_string()));
        let result = handle_editor_create(&cmd, None);

        assert!(result.is_ok());
        let events = result.unwrap();
        assert_eq!(events.len(), 1);

        let event = &events[0];
        let value = &event.value;
        assert_eq!(value["name"], "CodeReviewer");
        assert_eq!(value["editor_type"], "Bot");
    }

    #[test]
    fn test_editor_create_defaults_to_human_when_type_not_specified() {
        let cmd = create_test_command("Bob", None);
        let result = handle_editor_create(&cmd, None);

        assert!(result.is_ok());
        let events = result.unwrap();
        let event = &events[0];
        let value = &event.value;

        // Should default to Human
        assert_eq!(value["editor_type"], "Human");
        assert_eq!(value["name"], "Bob");
    }

    #[test]
    fn test_editor_create_generates_unique_ids() {
        let cmd1 = create_test_command("Alice", None);
        let cmd2 = create_test_command("Bob", None);

        let result1 = handle_editor_create(&cmd1, None).unwrap();
        let result2 = handle_editor_create(&cmd2, None).unwrap();

        let editor_id_1 = result1[0].value["editor_id"].as_str().unwrap();
        let editor_id_2 = result2[0].value["editor_id"].as_str().unwrap();

        // IDs should be unique
        assert_ne!(editor_id_1, editor_id_2);

        // Entity should match editor_id
        assert_eq!(result1[0].entity, editor_id_1);
        assert_eq!(result2[0].entity, editor_id_2);
    }

    #[test]
    fn test_editor_create_invalid_payload_returns_error() {
        let cmd = Command {
            cmd_id: uuid::Uuid::new_v4().to_string(),
            editor_id: "test-editor".to_string(),
            cap_id: "editor.create".to_string(),
            block_id: "system".to_string(),
            payload: serde_json::json!({}), // Missing "name" field
            timestamp: chrono::Utc::now(),
        };

        let result = handle_editor_create(&cmd, None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid payload"));
    }

    #[test]
    fn test_editor_create_event_attribute_format() {
        let cmd = create_test_command("Alice", None);
        let result = handle_editor_create(&cmd, None).unwrap();

        let event = &result[0];
        // Attribute should be "{editor_id}/{capability_id}"
        assert_eq!(event.attribute, "test-editor/editor.create");
    }
}
