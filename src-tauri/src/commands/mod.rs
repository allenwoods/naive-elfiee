pub mod block;
pub mod block_with_sync;
pub mod editor;
pub mod file;

// Re-export all commands for easy registration
pub use block::{execute_command, get_all_blocks, get_block, list_block_files};
pub use block_with_sync::{execute_command_with_sync, get_all_blocks_with_sync, get_block_with_sync};
pub use file::{close_file, create_file, get_all_events, list_open_files, open_file, save_file};

// Tests module
#[cfg(test)]
mod tests;
