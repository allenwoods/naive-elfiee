pub mod markdown_read;
/// Markdown extension for Elfiee.
///
/// This extension provides capabilities for reading and writing markdown content
/// to blocks of type "markdown".
///
/// ## Capabilities
///
/// - `markdown.write`: Write markdown content to a block
/// - `markdown.read`: Read markdown content from a block
///
/// ## Usage Example
///
/// ```rust,ignore
/// use elfiee::models::{Block, Command};
/// use elfiee::capabilities::CapabilityRegistry;
///
/// // Create a markdown block
/// let block = Block::new(
///     "My Document".to_string(),
///     "markdown".to_string(),
///     "alice".to_string(),
/// );
///
/// // Write markdown content
/// let write_cmd = Command::new(
///     "alice".to_string(),
///     "markdown.write".to_string(),
///     block.block_id.clone(),
///     serde_json::json!({ "content": "# Hello World\n\nThis is markdown." }),
/// );
///
/// // Read markdown content
/// let read_cmd = Command::new(
///     "alice".to_string(),
///     "markdown.read".to_string(),
///     block.block_id.clone(),
///     serde_json::json!({}),
/// );
/// ```
pub mod markdown_write;

// Re-export the capability handlers for registration
pub use markdown_read::*;
pub use markdown_write::*;

#[cfg(test)]
mod tests {
    use crate::capabilities::grants::GrantsTable;
    use crate::capabilities::CapabilityRegistry;
    use crate::models::{Block, Command};

    #[test]
    fn test_markdown_write_capability() {
        let registry = CapabilityRegistry::new();
        let cap = registry
            .get("markdown.write")
            .expect("markdown.write should be registered");

        let block = Block::new(
            "My Document".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );

        let cmd = Command::new(
            "alice".to_string(),
            "markdown.write".to_string(),
            block.block_id.clone(),
            serde_json::json!({
                "content": "# Hello World\n\nThis is **markdown** content."
            }),
        );

        let events = cap.handler(&cmd, Some(&block)).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].entity, block.block_id);
        assert_eq!(events[0].attribute, "alice/markdown.write");

        // Verify content is stored correctly
        let contents = events[0].value.get("contents").unwrap();
        let markdown = contents.get("markdown").unwrap().as_str().unwrap();
        assert_eq!(markdown, "# Hello World\n\nThis is **markdown** content.");
    }

    #[test]
    fn test_markdown_read_capability() {
        let registry = CapabilityRegistry::new();
        let cap = registry
            .get("markdown.read")
            .expect("markdown.read should be registered");

        // Create a block with existing markdown content
        let mut block = Block::new(
            "My Document".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );
        block.contents = serde_json::json!({
            "markdown": "# Existing Content\n\nThis is already here."
        });

        let cmd = Command::new(
            "alice".to_string(),
            "markdown.read".to_string(),
            block.block_id.clone(),
            serde_json::json!({}),
        );

        let events = cap.handler(&cmd, Some(&block)).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].entity, cmd.editor_id); // Entity is reader
        assert_eq!(events[0].attribute, "alice/markdown.read");

        // Verify read event contains the content
        let read_content = events[0].value.get("content").unwrap().as_str().unwrap();
        assert_eq!(read_content, "# Existing Content\n\nThis is already here.");
    }

    #[test]
    fn test_markdown_write_missing_content_fails() {
        let registry = CapabilityRegistry::new();
        let cap = registry.get("markdown.write").unwrap();

        let block = Block::new(
            "My Document".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );

        let cmd = Command::new(
            "alice".to_string(),
            "markdown.write".to_string(),
            block.block_id.clone(),
            serde_json::json!({}), // Missing content field
        );

        let result = cap.handler(&cmd, Some(&block));
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing 'content' in payload");
    }

    #[test]
    fn test_markdown_read_no_content_fails() {
        let registry = CapabilityRegistry::new();
        let cap = registry.get("markdown.read").unwrap();

        // Block with empty contents
        let block = Block::new(
            "Empty Document".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );

        let cmd = Command::new(
            "alice".to_string(),
            "markdown.read".to_string(),
            block.block_id.clone(),
            serde_json::json!({}),
        );

        let result = cap.handler(&cmd, Some(&block));
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "No markdown content found in block");
    }

    #[test]
    fn test_markdown_write_authorization_owner() {
        let grants_table = GrantsTable::new();
        let registry = CapabilityRegistry::new();

        // Owner is alice
        let block = Block::new(
            "My Document".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );

        // Alice (owner) writes
        let cmd = Command::new(
            "alice".to_string(),
            "markdown.write".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "content": "Owner content" }),
        );

        // Check authorization
        let is_authorized = block.owner == cmd.editor_id
            || grants_table.has_grant(&cmd.editor_id, "markdown.write", &block.block_id);
        assert!(is_authorized, "Owner should be authorized");

        // Execute
        let cap = registry.get("markdown.write").unwrap();
        assert!(cap.handler(&cmd, Some(&block)).is_ok());
    }

    #[test]
    fn test_markdown_write_authorization_non_owner_without_grant() {
        let grants_table = GrantsTable::new();

        // Owner is alice
        let block = Block::new(
            "My Document".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );

        // Bob (non-owner) tries to write without grant
        let cmd = Command::new(
            "bob".to_string(),
            "markdown.write".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "content": "Unauthorized content" }),
        );

        // Check authorization
        let is_authorized = block.owner == cmd.editor_id
            || grants_table.has_grant(&cmd.editor_id, "markdown.write", &block.block_id);
        assert!(
            !is_authorized,
            "Non-owner without grant should not be authorized"
        );
    }

    #[test]
    fn test_markdown_write_authorization_non_owner_with_grant() {
        let mut grants_table = GrantsTable::new();
        let registry = CapabilityRegistry::new();

        // Owner is alice
        let block = Block::new(
            "My Document".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );

        // Grant bob permission to write
        grants_table.add_grant(
            "bob".to_string(),
            "markdown.write".to_string(),
            block.block_id.clone(),
        );

        // Bob writes with grant
        let cmd = Command::new(
            "bob".to_string(),
            "markdown.write".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "content": "Authorized content" }),
        );

        // Check authorization
        let is_authorized = block.owner == cmd.editor_id
            || grants_table.has_grant(&cmd.editor_id, "markdown.write", &block.block_id);
        assert!(is_authorized, "Non-owner with grant should be authorized");

        // Execute
        let cap = registry.get("markdown.write").unwrap();
        assert!(cap.handler(&cmd, Some(&block)).is_ok());
    }

    #[test]
    fn test_markdown_read_authorization_wildcard() {
        let mut grants_table = GrantsTable::new();
        let registry = CapabilityRegistry::new();

        // Grant bob wildcard read permission
        grants_table.add_grant(
            "bob".to_string(),
            "markdown.read".to_string(),
            "*".to_string(),
        );

        // Create a markdown block owned by alice
        let mut block = Block::new(
            "My Document".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );
        block.contents = serde_json::json!({ "markdown": "Content" });

        // Bob reads with wildcard grant
        let cmd = Command::new(
            "bob".to_string(),
            "markdown.read".to_string(),
            block.block_id.clone(),
            serde_json::json!({}),
        );

        // Check authorization
        let is_authorized = block.owner == cmd.editor_id
            || grants_table.has_grant(&cmd.editor_id, "markdown.read", &block.block_id);
        assert!(is_authorized, "Wildcard grant should authorize access");

        // Execute
        let cap = registry.get("markdown.read").unwrap();
        assert!(cap.handler(&cmd, Some(&block)).is_ok());
    }

    #[test]
    fn test_markdown_write_updates_existing_content() {
        let registry = CapabilityRegistry::new();
        let cap = registry.get("markdown.write").unwrap();

        // Block with existing content
        let mut block = Block::new(
            "My Document".to_string(),
            "markdown".to_string(),
            "alice".to_string(),
        );
        block.contents = serde_json::json!({
            "markdown": "Old content",
            "other_field": "preserved"
        });

        // Write new markdown content
        let cmd = Command::new(
            "alice".to_string(),
            "markdown.write".to_string(),
            block.block_id.clone(),
            serde_json::json!({ "content": "New content" }),
        );

        let events = cap.handler(&cmd, Some(&block)).unwrap();
        let contents = events[0].value.get("contents").unwrap();

        // Verify markdown was updated
        assert_eq!(
            contents.get("markdown").unwrap().as_str().unwrap(),
            "New content"
        );
        // Verify other fields are preserved
        assert_eq!(
            contents.get("other_field").unwrap().as_str().unwrap(),
            "preserved"
        );
    }
}
