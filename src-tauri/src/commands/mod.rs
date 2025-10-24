pub mod file;
pub mod block;

// Re-export all commands for easy registration
pub use file::{create_file, open_file, save_file, close_file, list_open_files};
pub use block::{execute_command, get_block, get_all_blocks};
