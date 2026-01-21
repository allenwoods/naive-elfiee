pub mod block_type_inference;
pub mod fs_scanner;
pub mod path_validator;
pub mod pty;
/// Utility modules for Elfiee application
///
/// This module provides common utility functions used throughout the application.
pub mod time;

// Re-export ONLY the single primary public API
// All other functions are internal (pub(crate)) to enforce consistent time format usage
pub use time::{
    now_utc, // The ONLY public function: Get current UTC timestamp in RFC 3339 format
};

/// Infers the block type based on file extension.
pub use block_type_inference::infer_block_type;

/// Scans directories recursively with security limits and filtering.
pub use fs_scanner::{scan_directory, FileInfo, ScanOptions};

/// Validates file paths to prevent traversal attacks and access to sensitive directories.
pub use path_validator::{is_safe_path, validate_virtual_path};

/// PTY (Pseudo-Terminal) pure utility functions for terminal operations.
pub use pty::{
    close as pty_close, resize as pty_resize, spawn as pty_spawn, write as pty_write, PtyHandle,
    SpawnConfig,
};
