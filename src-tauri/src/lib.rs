pub mod capabilities;
pub mod commands;
pub mod elf;
pub mod engine;
pub mod extensions;
pub mod models;
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
                commands::file::get_all_events,
                // Block operations
                commands::block::execute_command,
                commands::block::get_block,
                commands::block::get_all_blocks,
                commands::block::list_block_files,
                // Editor operations
                commands::editor::create_editor,
                commands::editor::list_editors,
                commands::editor::get_editor,
                commands::editor::set_active_editor,
                commands::editor::get_active_editor,
                // Grant operations
                commands::editor::list_grants,
                commands::editor::get_editor_grants,
                commands::editor::get_block_grants,

            ])
            // Explicitly export payload types for frontend type generation
            // These types are used inside Command.payload but not in Tauri command signatures,
            // so specta cannot automatically discover them. We must register them manually.
            // NOTE: When adding a new extension with payload types, register them here.
            // TODO: Consider automating this with a macro if extensions grow beyond ~10
            // Core payload types (used by builtin capabilities)
            .typ::<models::CreateBlockPayload>()
            .typ::<models::LinkBlockPayload>()
            .typ::<models::UnlinkBlockPayload>()
            .typ::<models::GrantPayload>()
            .typ::<models::RevokePayload>()
            .typ::<models::EditorCreatePayload>()
            // Extension payload types
            .typ::<extensions::markdown::MarkdownWritePayload>()
            .typ::<extensions::terminal::TerminalExecutePayload>();

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
        commands::file::get_all_events,
        // Block operations
        commands::block::execute_command,
        commands::block::get_block,
        commands::block::get_all_blocks,
        commands::block::list_block_files,
        // Editor operations
        commands::editor::create_editor,
        commands::editor::list_editors,
        commands::editor::get_editor,
        commands::editor::set_active_editor,
        commands::editor::get_active_editor,
        // Grant operations
        commands::editor::list_grants,
        commands::editor::get_editor_grants,
        commands::editor::get_block_grants,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
