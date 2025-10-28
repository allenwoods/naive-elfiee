pub mod block;
pub mod editor;
pub mod file;

// Re-export all commands for easy registration
pub use block::{execute_command, get_all_blocks, get_block};
pub use file::{close_file, create_file, get_all_events, list_open_files, open_file, save_file};
