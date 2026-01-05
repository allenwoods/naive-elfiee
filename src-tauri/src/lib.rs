pub mod capabilities;
pub mod commands;
pub mod config;
pub mod elf;
pub mod engine;
pub mod extensions;
pub mod models;
pub mod state;
pub mod utils;

use state::AppState;

#[cfg(debug_assertions)]
use specta_typescript::{BigIntExportBehavior, Typescript};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .manage(extensions::terminal::pty::TerminalState::new());

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
                commands::file::get_file_info,
                commands::file::rename_file,
                commands::file::delete_file,
                commands::file::duplicate_file,
                commands::file::get_system_editor_id_from_config,
                // Event operations (Timeline feature)
                commands::event::get_block_at_event,
                commands::event::get_state_at_event,
                // Block operations (core)
                commands::block::execute_command,
                commands::block::get_block,
                commands::block::get_all_blocks,
                commands::block::update_block_metadata,
                commands::block::rename_block,
                commands::block::update_block_type,
                commands::block::check_permission,
                // Editor operations
                commands::editor::create_editor,
                commands::editor::delete_editor,
                commands::editor::list_editors,
                commands::editor::get_editor,
                commands::editor::set_active_editor,
                commands::editor::get_active_editor,
                // Grant operations
                commands::editor::list_grants,
                commands::editor::get_editor_grants,
                commands::editor::get_block_grants,
                // Workspace/Checkout operations
                commands::checkout::checkout_workspace,
                // Terminal operations
                extensions::terminal::pty::async_init_terminal,
                extensions::terminal::pty::write_to_pty,
                extensions::terminal::pty::resize_pty,
                extensions::terminal::pty::close_terminal_session,
            ])
            // Explicitly export payload types for frontend type generation
            // These types are used inside Command.payload but not in Tauri command signatures,
            // so specta cannot automatically discover them. We must register them manually.
            // NOTE: When adding a new extension with payload types, register them here.
            // TODO: Consider automating this with a macro if extensions grow beyond ~10
            // Core payload types (used by builtin capabilities)
            .typ::<extensions::code::CodeWritePayload>()
            .typ::<extensions::code::CodeReadPayload>()
            .typ::<extensions::directory::DirectoryRenamePayload>()
            .typ::<extensions::directory::DirectoryDeletePayload>()
            .typ::<extensions::directory::DirectoryCreatePayload>()
            .typ::<extensions::directory::DirectoryExportPayload>()
            .typ::<extensions::directory::DirectoryImportPayload>()
            .typ::<extensions::directory::DirectoryWritePayload>()
            .typ::<models::CreateBlockPayload>()
            .typ::<models::LinkBlockPayload>()
            .typ::<models::UnlinkBlockPayload>()
            .typ::<models::GrantPayload>()
            .typ::<models::RevokePayload>()
            .typ::<models::UpdateMetadataPayload>()
            .typ::<models::EditorCreatePayload>()
            .typ::<models::EditorDeletePayload>()
            // Extension payload types
            .typ::<extensions::markdown::MarkdownWritePayload>()
            .typ::<extensions::terminal::TerminalSavePayload>()
            .typ::<extensions::terminal::pty::TerminalInitPayload>()
            .typ::<extensions::terminal::pty::TerminalWritePayload>()
            .typ::<extensions::terminal::pty::TerminalResizePayload>()
            // File metadata types
            .typ::<commands::FileMetadata>()
            // Block metadata types
            .typ::<models::BlockMetadata>()
            // Event types
            .typ::<commands::event::StateSnapshot>();

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
        commands::file::get_file_info,
        commands::file::rename_file,
        commands::file::delete_file,
        commands::file::duplicate_file,
        commands::file::get_system_editor_id_from_config,
        // Event operations (Timeline feature)
        commands::event::get_block_at_event,
        commands::event::get_state_at_event,
        // Block operations (core)
        commands::block::execute_command,
        commands::block::get_block,
        commands::block::get_all_blocks,
        commands::block::update_block_metadata,
        commands::block::rename_block,
        commands::block::update_block_type,
        commands::block::check_permission,
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
        // Workspace/Checkout operations
        commands::checkout::checkout_workspace,
        // Terminal operations
        extensions::terminal::pty::async_init_terminal,
        extensions::terminal::pty::write_to_pty,
        extensions::terminal::pty::resize_pty,
        extensions::terminal::pty::close_terminal_session,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
