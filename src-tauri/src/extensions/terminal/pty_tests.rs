//! Tests for PTY management and shell initialization

use super::pty::generate_shell_init;
use super::{TerminalInitPayload, TerminalResizePayload, TerminalWritePayload};
use serde_json::json;
use std::path::PathBuf;

/// Test 1: Shell initialization script generation for bash/zsh
///
/// Verifies:
/// - Script includes ELF_WORK_DIR environment variable
/// - Script includes cd ~ function override
/// - Script includes proper initialization
#[test]
fn test_bash_init_script_generation() {
    let work_dir = PathBuf::from("/tmp/test-elf-workspace");

    let script = generate_shell_init(&work_dir, "bash");
    assert!(script.is_ok(), "Should generate bash script");

    let script = script.unwrap();

    // Verify script contains essential components
    assert!(
        script.contains("export ELF_WORK_DIR="),
        "Script should export ELF_WORK_DIR"
    );
    assert!(
        script.contains("/tmp/test-elf-workspace"),
        "Script should contain the work directory path"
    );
    assert!(
        script.contains("cd()"),
        "Script should define cd function override"
    );
    assert!(
        script.contains("builtin cd"),
        "Script should use builtin cd"
    );
    assert!(
        script.contains("clear"),
        "Script should clear the screen"
    );
}

/// Test 2: Shell initialization script generation for zsh
///
/// Verifies:
/// - zsh uses same script as bash (compatible syntax)
#[test]
fn test_zsh_init_script_generation() {
    let work_dir = PathBuf::from("/home/user/.elf-workspace");

    let script = generate_shell_init(&work_dir, "zsh");
    assert!(script.is_ok(), "Should generate zsh script");

    let script = script.unwrap();

    // zsh should have same structure as bash
    assert!(script.contains("export ELF_WORK_DIR="));
    assert!(script.contains("/home/user/.elf-workspace"));
    assert!(script.contains("cd()"));
}

/// Test 3: PowerShell initialization script (returns empty string)
///
/// Verifies:
/// - PowerShell uses profile script mechanism instead
/// - generate_shell_init returns empty string for PowerShell
#[test]
fn test_powershell_init_script_generation() {
    let work_dir = PathBuf::from("C:\\Users\\test\\.elf-workspace");

    let script = generate_shell_init(&work_dir, "powershell");
    assert!(script.is_ok(), "Should handle PowerShell");

    let script = script.unwrap();

    // PowerShell uses profile script, so this should be empty
    assert_eq!(
        script, "",
        "PowerShell should return empty string (uses profile instead)"
    );
}

/// Test 4: Unsupported shell type
///
/// Verifies:
/// - Returns error for unsupported shell types
#[test]
fn test_unsupported_shell() {
    let work_dir = PathBuf::from("/tmp/test");

    let result = generate_shell_init(&work_dir, "fish");
    assert!(result.is_err(), "Should reject unsupported shell");

    let error = result.unwrap_err();
    assert!(
        error.contains("Unsupported shell"),
        "Error should mention unsupported shell"
    );
}

/// Test 5: TerminalInitPayload deserialization
///
/// Verifies:
/// - Payload deserializes correctly with all fields
#[test]
fn test_terminal_init_payload_deserialization() {
    let json = json!({
        "cols": 80,
        "rows": 24,
        "block_id": "block-123",
        "editor_id": "alice",
        "file_id": "file-456",
        "cwd": "/home/user/project"
    });

    let payload: Result<TerminalInitPayload, _> = serde_json::from_value(json);
    assert!(payload.is_ok(), "Payload should deserialize successfully");

    let payload = payload.unwrap();
    assert_eq!(payload.cols, 80);
    assert_eq!(payload.rows, 24);
    assert_eq!(payload.block_id, "block-123");
    assert_eq!(payload.editor_id, "alice");
    assert_eq!(payload.file_id, "file-456");
    assert_eq!(payload.cwd, Some("/home/user/project".to_string()));
}

/// Test 6: TerminalInitPayload with optional cwd
///
/// Verifies:
/// - cwd field can be null/omitted
#[test]
fn test_terminal_init_payload_optional_cwd() {
    let json = json!({
        "cols": 80,
        "rows": 24,
        "block_id": "block-123",
        "editor_id": "alice",
        "file_id": "file-456"
    });

    let payload: Result<TerminalInitPayload, _> = serde_json::from_value(json);
    assert!(payload.is_ok(), "Should deserialize without cwd");

    let payload = payload.unwrap();
    assert_eq!(payload.cwd, None, "cwd should be None");
}

/// Test 7: TerminalWritePayload deserialization
///
/// Verifies:
/// - Write payload deserializes correctly
#[test]
fn test_terminal_write_payload_deserialization() {
    let json = json!({
        "data": "ls -la\n",
        "block_id": "block-123",
        "file_id": "file-456",
        "editor_id": "alice"
    });

    let payload: Result<TerminalWritePayload, _> = serde_json::from_value(json);
    assert!(payload.is_ok(), "Payload should deserialize successfully");

    let payload = payload.unwrap();
    assert_eq!(payload.data, "ls -la\n");
    assert_eq!(payload.block_id, "block-123");
    assert_eq!(payload.file_id, "file-456");
    assert_eq!(payload.editor_id, "alice");
}

/// Test 8: TerminalResizePayload deserialization
///
/// Verifies:
/// - Resize payload deserializes correctly
#[test]
fn test_terminal_resize_payload_deserialization() {
    let json = json!({
        "cols": 120,
        "rows": 40,
        "block_id": "block-123",
        "file_id": "file-456",
        "editor_id": "alice"
    });

    let payload: Result<TerminalResizePayload, _> = serde_json::from_value(json);
    assert!(payload.is_ok(), "Payload should deserialize successfully");

    let payload = payload.unwrap();
    assert_eq!(payload.cols, 120);
    assert_eq!(payload.rows, 40);
    assert_eq!(payload.block_id, "block-123");
}

/// Test 9: cd ~ behavior verification in bash script
///
/// Verifies:
/// - Script correctly handles "~" argument
/// - Script redirects to ELF_WORK_DIR
#[test]
fn test_bash_script_cd_home_logic() {
    let work_dir = PathBuf::from("/tmp/elfiee-workspace");
    let script = generate_shell_init(&work_dir, "bash").unwrap();

    // Verify the cd function logic handles both ~ and $HOME
    assert!(
        script.contains(r#"if [ "$1" = "$HOME" ] || [ "$1" = "~" ]"#),
        "Script should check for both $HOME and ~"
    );
    assert!(
        script.contains(r#"builtin cd "$ELF_WORK_DIR""#),
        "Script should redirect to ELF_WORK_DIR"
    );
}

/// Test 10: Path with special characters
///
/// Verifies:
/// - Handles paths with spaces and special characters
#[test]
fn test_path_with_special_characters() {
    let work_dir = PathBuf::from("/tmp/elfiee workspace/test-123");
    let script = generate_shell_init(&work_dir, "bash");

    assert!(script.is_ok(), "Should handle paths with spaces");

    let script = script.unwrap();
    assert!(
        script.contains("/tmp/elfiee workspace/test-123"),
        "Path with spaces should be preserved"
    );
}
