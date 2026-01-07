use crate::engine::StateProjector;
use crate::models::{Block, Grant};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use specta::specta;
use specta::Type;
use tauri::State;

/// Full state snapshot at a specific point in time.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct StateSnapshot {
    /// Block state at that event
    pub block: Block,
    /// All grants in the system at that event
    pub grants: Vec<Grant>,
}

/// Get the full state snapshot (block + grants) at a specific event.
#[tauri::command]
#[specta]
pub async fn get_state_at_event(
    file_id: String,
    block_id: String,
    event_id: String,
    state: State<'_, AppState>,
) -> Result<StateSnapshot, String> {
    // 1. Get engine handle
    let handle = state
        .engine_manager
        .get_engine(&file_id)
        .ok_or_else(|| format!("File '{}' is not open", file_id))?;

    // 2. Get all events
    let all_events = handle.get_all_events().await?;

    // 3. Find the target event's index
    let target_index = all_events
        .iter()
        .position(|e| e.event_id == event_id)
        .ok_or_else(|| format!("Event '{}' not found", event_id))?;

    // 4. Create a temporary state projector and replay events up to the target
    let mut temp_projector = StateProjector::new();
    temp_projector.replay(all_events[..=target_index].to_vec());

    // 5. Extract the block snapshot
    let block = temp_projector
        .get_block(&block_id)
        .ok_or_else(|| format!("Block '{}' not found at event '{}'", block_id, event_id))?
        .clone();

    // 6. Extract grants
    let mut grants = Vec::new();
    for (editor_id, pairs) in temp_projector.grants.as_map() {
        for (cap_id, target_block) in pairs {
            grants.push(Grant::new(
                editor_id.clone(),
                cap_id.clone(),
                target_block.clone(),
            ));
        }
    }

    Ok(StateSnapshot { block, grants })
}

#[cfg(test)]
mod tests {
    use crate::engine::StateProjector;
    use crate::models::Event;
    use std::collections::HashMap;

    #[test]
    fn test_replay_events_to_target_point() {
        let mut projector = StateProjector::new();

        // Create a series of events simulating block creation and updates
        let events = vec![
            Event::new(
                "block1".to_string(),
                "system/core.create".to_string(),
                serde_json::json!({
                    "name": "Test Block",
                    "type": "markdown",
                    "owner": "system",
                    "contents": { "markdown": "Initial content" },
                    "children": {}
                }),
                {
                    let mut ts = HashMap::new();
                    ts.insert("system".to_string(), 1);
                    ts
                },
            ),
            Event::new(
                "block1".to_string(),
                "system/markdown.write".to_string(),
                serde_json::json!({
                    "contents": { "markdown": "Updated content v1" }
                }),
                {
                    let mut ts = HashMap::new();
                    ts.insert("system".to_string(), 2);
                    ts
                },
            ),
            Event::new(
                "block1".to_string(),
                "system/markdown.write".to_string(),
                serde_json::json!({
                    "contents": { "markdown": "Updated content v2" }
                }),
                {
                    let mut ts = HashMap::new();
                    ts.insert("system".to_string(), 3);
                    ts
                },
            ),
        ];

        // Replay only the first 2 events (create + first update)
        projector.replay(events[..2].to_vec());

        // Should have content from the second event
        let block = projector.get_block("block1").unwrap();
        let content = block
            .contents
            .get("markdown")
            .and_then(|v| v.as_str())
            .unwrap();
        assert_eq!(content, "Updated content v1");

        // Verify that v2 content is NOT present (we only replayed up to index 1)
        assert_ne!(content, "Updated content v2");
    }

    #[test]
    fn test_find_event_by_id() {
        let events = vec![
            Event::new(
                "block1".to_string(),
                "system/core.create".to_string(),
                serde_json::json!({}),
                HashMap::new(),
            ),
            Event::new(
                "block1".to_string(),
                "system/markdown.write".to_string(),
                serde_json::json!({}),
                HashMap::new(),
            ),
        ];

        // Find first event
        let target_id = &events[0].event_id;
        let index = events.iter().position(|e| &e.event_id == target_id);
        assert_eq!(index, Some(0));

        // Find second event
        let target_id = &events[1].event_id;
        let index = events.iter().position(|e| &e.event_id == target_id);
        assert_eq!(index, Some(1));

        // Non-existent event
        let index = events.iter().position(|e| &e.event_id == "nonexistent");
        assert_eq!(index, None);
    }
}
