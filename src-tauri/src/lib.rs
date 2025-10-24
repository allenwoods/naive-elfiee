pub mod models;
pub mod engine;
pub mod elf;
pub mod capabilities;
pub mod extensions;
pub mod commands;
pub mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // File operations
            commands::file::create_file,
            commands::file::open_file,
            commands::file::save_file,
            commands::file::close_file,
            commands::file::list_open_files,
            // Block operations
            commands::block::execute_command,
            commands::block::get_block,
            commands::block::get_all_blocks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
