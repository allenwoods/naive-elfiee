pub mod models;
pub mod engine;
pub mod elf;
pub mod capabilities;
pub mod extensions;
pub mod commands;
pub mod state;

use state::AppState;

#[cfg(debug_assertions)]
use specta_typescript::{BigIntExportBehavior, Typescript};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new());

    // Generate TypeScript bindings in debug mode
    #[cfg(debug_assertions)]
    let builder = {
        let specta_builder = tauri_specta::Builder::<tauri::Wry>::new()
            .commands(tauri_specta::collect_commands![
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
            ]);

        // Export TypeScript bindings on app startup
        #[cfg(debug_assertions)]
        specta_builder
            .export(
                Typescript::default().bigint(BigIntExportBehavior::Number),
                "../src/bindings.ts",
            )
            .expect("Failed to export TypeScript bindings");

        builder.invoke_handler(specta_builder.invoke_handler())
    };

    // Use standard handler in release mode
    #[cfg(not(debug_assertions))]
    let builder = builder.invoke_handler(tauri::generate_handler![
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
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
