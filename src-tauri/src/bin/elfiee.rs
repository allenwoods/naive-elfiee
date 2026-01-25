//! Elfiee CLI - Command line interface for .elf file operations
//!
//! This CLI provides terminal access to all Elfiee APIs defined in SKILL.md

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use serde_json::Value;
use std::path::Path;
use std::sync::Arc;

use elfiee_lib::elf::ElfArchive;
use elfiee_lib::engine::EngineManager;
use elfiee_lib::models::Command;

/// CLI application state
struct CliState {
    engine_manager: EngineManager,
    file_path: Option<String>,
    file_id: Option<String>,
    active_editor_id: Option<String>,
    archive: Option<Arc<ElfArchive>>,
}

impl CliState {
    fn new() -> Self {
        Self {
            engine_manager: EngineManager::new(),
            file_path: None,
            file_id: None,
            active_editor_id: None,
            archive: None,
        }
    }

    /// Bootstrap editors for the file (create system editor if none exist)
    async fn bootstrap_editors(&mut self) -> Result<()> {
        let file_id = self
            .file_id
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No file open"))?;

        let handle = self
            .engine_manager
            .get_engine(file_id)
            .ok_or_else(|| anyhow::anyhow!("Engine not found"))?;

        let editors = handle.get_all_editors().await;

        if editors.is_empty() {
            // Create system editor
            let system_id =
                elfiee_lib::config::get_system_editor_id().unwrap_or_else(|_| "system".to_string());

            let cmd = Command::new(
                system_id.clone(),
                "editor.create".to_string(),
                "".to_string(),
                serde_json::json!({
                    "editor_id": system_id,
                    "name": "CLI User",
                    "editor_type": "Human"
                }),
            );

            let events = handle
                .process_command(cmd)
                .await
                .map_err(|e| anyhow::anyhow!(e))?;

            if let Some(event) = events.first() {
                self.active_editor_id = Some(event.entity.clone());
            }
        } else {
            // Use first editor as active
            if let Some((first_editor_id, _)) = editors.iter().next() {
                self.active_editor_id = Some(first_editor_id.clone());
            }
        }

        Ok(())
    }
}

// Help text constants
const MAIN_HELP: &str = r##"
Elfiee CLI - Command line interface for .elf file operations

Elfiee is a block-based editor for the .elf file format. This CLI provides
terminal access to all Elfiee APIs for creating, reading, and manipulating
.elf files.

CORE CONCEPTS:
  Block      - Fundamental content unit (markdown, code, directory, etc.)
  Editor     - User or agent that performs operations
  Capability - Action that can be performed (e.g., markdown.write, core.create)
  Event      - Immutable record of a change

QUICK START:
  1. Create a new file:       elfiee file create ./notes.elf
  2. Create a root block:     elfiee exec ./notes.elf "" core.create <payload>
  3. List blocks:             elfiee block list ./notes.elf
  4. View file info:          elfiee file info ./notes.elf
"##;

const EXAMPLES_HELP: &str = r##"
EXAMPLES:
  elfiee file create ./project.elf
  elfiee file info ./project.elf
  elfiee block list ./project.elf
  elfiee block get ./project.elf <block_id>
  elfiee event list ./project.elf
  elfiee exec ./project.elf "" core.create <json_payload>
  elfiee exec ./project.elf <block_id> markdown.write <json_payload>
  elfiee --format json block list ./project.elf

PAYLOAD FORMAT (JSON):
  core.create:     {"name":"my-block","block_type":"directory"}
  markdown.write:  {"content":"# Hello World"}
  core.link:       {"child_id":"<id>","relation":"contains"}
  core.grant:      {"editor_id":"<id>","cap_id":"markdown.write"}

CAPABILITIES:
  core.create      - Create a new block
  core.link        - Link blocks together
  core.unlink      - Remove a link between blocks
  core.grant       - Grant capability to an editor
  core.revoke      - Revoke capability from an editor
  markdown.write   - Write markdown content
  markdown.read    - Read markdown content
  directory.create - Create directory block
  directory.delete - Delete directory block
"##;

const EXEC_HELP: &str = r##"
EXAMPLES:
  elfiee exec ./file.elf "" core.create {"name":"root","block_type":"directory"}
  elfiee exec ./file.elf <block_id> markdown.write {"content":"# Hello"}
  elfiee exec ./file.elf <parent_id> core.link {"child_id":"<id>","relation":"contains"}

COMMON CAPABILITIES:
  core.create       Create a new block
  core.link         Link blocks (parent-child)
  core.unlink       Remove link between blocks
  core.grant        Grant capability to editor
  core.revoke       Revoke capability from editor
  markdown.write    Write markdown content
  markdown.read     Read markdown content
  directory.create  Create directory block
  directory.delete  Delete directory block
"##;

/// Elfiee CLI - Command line interface for .elf file operations
#[derive(Parser)]
#[command(name = "elfiee")]
#[command(author, version)]
#[command(about = "CLI for .elf file operations")]
#[command(long_about = MAIN_HELP)]
#[command(after_help = EXAMPLES_HELP)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Output format: json, pretty, plain
    #[arg(short, long, default_value = "pretty", global = true)]
    format: OutputFormat,
}

#[derive(Clone, Copy, Debug, Default, clap::ValueEnum)]
enum OutputFormat {
    /// JSON output (compact)
    Json,
    /// JSON output (pretty-printed)
    #[default]
    Pretty,
    /// Plain text output
    Plain,
}

#[derive(Subcommand)]
enum Commands {
    /// File operations (create, open, info)
    File {
        #[command(subcommand)]
        action: FileCommands,
    },

    /// Block operations (get, list)
    Block {
        #[command(subcommand)]
        action: BlockCommands,
    },

    /// Execute a capability on a block
    #[command(after_help = EXEC_HELP)]
    Exec {
        /// Path to the .elf file
        path: String,

        /// Block ID (use empty string for root-level operations)
        block_id: String,

        /// Capability ID (e.g., markdown.write, core.create)
        capability: String,

        /// Payload as JSON string
        #[arg(default_value = "{}")]
        payload: String,
    },

    /// Editor operations (list)
    Editor {
        #[command(subcommand)]
        action: EditorCommands,
    },

    /// Grant/permission operations (list, check)
    Grant {
        #[command(subcommand)]
        action: GrantCommands,
    },

    /// Event history operations
    Event {
        #[command(subcommand)]
        action: EventCommands,
    },

    /// PTY/Terminal operations (requires GUI, not supported in CLI)
    Pty {
        #[command(subcommand)]
        action: PtyCommands,
    },
}

// ============================================================================
// File Commands
// ============================================================================

#[derive(Subcommand)]
enum FileCommands {
    /// Create a new .elf file
    Create {
        /// Path where the .elf file will be created
        path: String,
    },

    /// Open an existing .elf file and show summary
    Open {
        /// Path to the .elf file
        path: String,
    },

    /// Show detailed file information (blocks, editors, events)
    Info {
        /// Path to the .elf file
        path: String,
    },
}

// ============================================================================
// Block Commands
// ============================================================================

#[derive(Subcommand)]
enum BlockCommands {
    /// Get detailed information about a specific block
    Get {
        /// Path to the .elf file
        path: String,
        /// Block ID (UUID format)
        block_id: String,
    },

    /// List all blocks in a file
    List {
        /// Path to the .elf file
        path: String,
    },
}

// ============================================================================
// Editor Commands
// ============================================================================

#[derive(Subcommand)]
enum EditorCommands {
    /// List all editors (users/agents) in a file
    List {
        /// Path to the .elf file
        path: String,
    },
}

// ============================================================================
// Grant Commands
// ============================================================================

#[derive(Subcommand)]
enum GrantCommands {
    /// List all capability grants in a file
    List {
        /// Path to the .elf file
        path: String,
    },

    /// Check if an editor has permission for a capability on a block
    Check {
        /// Path to the .elf file
        path: String,
        /// Editor ID to check
        editor_id: String,
        /// Block ID to check permission on
        block_id: String,
        /// Capability ID (e.g., markdown.write, core.create)
        cap_id: String,
    },
}

// ============================================================================
// Event Commands
// ============================================================================

#[derive(Subcommand)]
enum EventCommands {
    /// List all events (history) in a file
    List {
        /// Path to the .elf file
        path: String,
        /// Maximum number of events to return
        #[arg(short, long)]
        limit: Option<usize>,
    },
}

// ============================================================================
// PTY Commands
// ============================================================================

#[derive(Subcommand)]
enum PtyCommands {
    /// Initialize a PTY session
    Init {
        /// Block ID
        block_id: String,
        /// Terminal columns
        #[arg(long, default_value = "80")]
        cols: u16,
        /// Terminal rows
        #[arg(long, default_value = "24")]
        rows: u16,
        /// Working directory
        #[arg(long)]
        cwd: Option<String>,
    },
    /// Write data to PTY
    Write {
        /// Block ID
        block_id: String,
        /// Data to write
        data: String,
    },
    /// Resize PTY
    Resize {
        /// Block ID
        block_id: String,
        /// Terminal columns
        #[arg(long)]
        cols: u16,
        /// Terminal rows
        #[arg(long)]
        rows: u16,
    },
    /// Close PTY session
    Close {
        /// Block ID
        block_id: String,
    },
}

// ============================================================================
// Main Entry Point
// ============================================================================

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    let result = match cli.command {
        Commands::File { action } => handle_file(action).await,
        Commands::Block { action } => handle_block(action).await,
        Commands::Exec {
            path,
            block_id,
            capability,
            payload,
        } => handle_exec(&path, &block_id, &capability, &payload).await,
        Commands::Editor { action } => handle_editor(action).await,
        Commands::Grant { action } => handle_grant(action).await,
        Commands::Event { action } => handle_event(action).await,
        Commands::Pty { action } => handle_pty(action).await,
    };

    match result {
        Ok(output) => {
            print_output(&output, cli.format);
            Ok(())
        }
        Err(e) => {
            eprintln!("Error: {:#}", e);
            std::process::exit(1);
        }
    }
}

// ============================================================================
// Output Formatting
// ============================================================================

fn print_output(value: &Value, format: OutputFormat) {
    match format {
        OutputFormat::Json => {
            println!("{}", serde_json::to_string(value).unwrap_or_default());
        }
        OutputFormat::Pretty => {
            println!(
                "{}",
                serde_json::to_string_pretty(value).unwrap_or_default()
            );
        }
        OutputFormat::Plain => {
            print_plain(value, 0);
        }
    }
}

fn print_plain(value: &Value, indent: usize) {
    let prefix = "  ".repeat(indent);
    match value {
        Value::Null => println!("{prefix}null"),
        Value::Bool(b) => println!("{prefix}{b}"),
        Value::Number(n) => println!("{prefix}{n}"),
        Value::String(s) => println!("{prefix}{s}"),
        Value::Array(arr) => {
            for item in arr {
                print_plain(item, indent);
            }
        }
        Value::Object(obj) => {
            for (key, val) in obj {
                match val {
                    Value::Object(_) | Value::Array(_) => {
                        println!("{prefix}{key}:");
                        print_plain(val, indent + 1);
                    }
                    _ => {
                        print!("{prefix}{key}: ");
                        print_plain(val, 0);
                    }
                }
            }
        }
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Open a file and return initialized CLI state
async fn open_file_for_cli(path: &str) -> Result<CliState> {
    let mut state = CliState::new();

    // Check if file exists
    let file_path = Path::new(path);
    if !file_path.exists() {
        return Err(anyhow::anyhow!("File not found: {}", path));
    }

    // Open archive
    let archive =
        ElfArchive::open(file_path).map_err(|e| anyhow::anyhow!("Failed to open file: {}", e))?;

    // Get event pool
    let event_pool = archive
        .event_pool()
        .await
        .map_err(|e| anyhow::anyhow!("Failed to get event pool: {}", e))?;

    // Generate file ID
    let file_id = format!("file-{}", uuid::Uuid::new_v4());

    // Spawn engine
    state
        .engine_manager
        .spawn_engine(file_id.clone(), event_pool)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to spawn engine: {}", e))?;

    state.file_path = Some(path.to_string());
    state.file_id = Some(file_id);
    state.archive = Some(Arc::new(archive));

    // Bootstrap editors
    state.bootstrap_editors().await?;

    Ok(state)
}

/// Create a new file and return initialized CLI state
async fn create_file_for_cli(path: &str) -> Result<CliState> {
    let mut state = CliState::new();

    let file_path = Path::new(path);

    // Check if file already exists
    if file_path.exists() {
        return Err(anyhow::anyhow!("File already exists: {}", path));
    }

    // Create new archive
    let archive = ElfArchive::new()
        .await
        .map_err(|e| anyhow::anyhow!("Failed to create archive: {}", e))?;

    // Save to path
    archive
        .save(file_path)
        .map_err(|e| anyhow::anyhow!("Failed to save file: {}", e))?;

    // Get event pool
    let event_pool = archive
        .event_pool()
        .await
        .map_err(|e| anyhow::anyhow!("Failed to get event pool: {}", e))?;

    // Generate file ID
    let file_id = format!("file-{}", uuid::Uuid::new_v4());

    // Spawn engine
    state
        .engine_manager
        .spawn_engine(file_id.clone(), event_pool)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to spawn engine: {}", e))?;

    state.file_path = Some(path.to_string());
    state.file_id = Some(file_id);
    state.archive = Some(Arc::new(archive));

    // Bootstrap editors
    state.bootstrap_editors().await?;

    // Save again to persist the editor creation events
    if let Some(archive) = &state.archive {
        archive
            .save(file_path)
            .map_err(|e| anyhow::anyhow!("Failed to save file: {}", e))?;
    }

    Ok(state)
}

// ============================================================================
// Handler Implementations
// ============================================================================

async fn handle_file(action: FileCommands) -> Result<Value> {
    match action {
        FileCommands::Create { path } => {
            let state = create_file_for_cli(&path).await?;

            // Get root block info
            let file_id = state.file_id.as_ref().unwrap();
            let handle = state.engine_manager.get_engine(file_id).unwrap();
            let blocks = handle.get_all_blocks().await;

            // Get first block (root)
            let root_block_id = blocks.values().next().map(|b| b.block_id.clone());

            Ok(serde_json::json!({
                "status": "created",
                "path": path,
                "file_id": file_id,
                "root_block_id": root_block_id,
                "editor_id": state.active_editor_id
            }))
        }
        FileCommands::Open { path } => {
            let state = open_file_for_cli(&path).await?;

            let file_id = state.file_id.as_ref().unwrap();
            let handle = state.engine_manager.get_engine(file_id).unwrap();
            let blocks = handle.get_all_blocks().await;
            let editors = handle.get_all_editors().await;

            Ok(serde_json::json!({
                "status": "opened",
                "path": path,
                "file_id": file_id,
                "block_count": blocks.len(),
                "editor_count": editors.len(),
                "active_editor_id": state.active_editor_id
            }))
        }
        FileCommands::Info { path } => {
            let state = open_file_for_cli(&path).await?;

            let file_id = state.file_id.as_ref().unwrap();
            let handle = state.engine_manager.get_engine(file_id).unwrap();
            let blocks = handle.get_all_blocks().await;
            let editors = handle.get_all_editors().await;
            let events = handle
                .get_all_events()
                .await
                .map_err(|e| anyhow::anyhow!(e))?;

            // Collect editor info
            let editor_list: Vec<Value> = editors
                .iter()
                .map(|(id, editor)| {
                    serde_json::json!({
                        "editor_id": id,
                        "name": editor.name,
                        "editor_type": format!("{:?}", editor.editor_type)
                    })
                })
                .collect();

            Ok(serde_json::json!({
                "path": path,
                "block_count": blocks.len(),
                "event_count": events.len(),
                "editors": editor_list
            }))
        }
    }
}

async fn handle_block(action: BlockCommands) -> Result<Value> {
    match action {
        BlockCommands::Get { path, block_id } => {
            let state = open_file_for_cli(&path).await?;

            let file_id = state.file_id.as_ref().unwrap();
            let handle = state.engine_manager.get_engine(file_id).unwrap();

            let block = handle
                .get_block(block_id.clone())
                .await
                .ok_or_else(|| anyhow::anyhow!("Block not found: {}", block_id))?;

            Ok(serde_json::to_value(&block)?)
        }
        BlockCommands::List { path } => {
            let state = open_file_for_cli(&path).await?;

            let file_id = state.file_id.as_ref().unwrap();
            let handle = state.engine_manager.get_engine(file_id).unwrap();
            let blocks = handle.get_all_blocks().await;

            let block_list: Vec<Value> = blocks
                .values()
                .map(|block| {
                    serde_json::json!({
                        "block_id": block.block_id,
                        "name": block.name,
                        "block_type": block.block_type,
                        "owner": block.owner,
                        "children_count": block.children.len()
                    })
                })
                .collect();

            Ok(serde_json::json!({
                "path": path,
                "count": blocks.len(),
                "blocks": block_list
            }))
        }
    }
}

async fn handle_exec(path: &str, block_id: &str, capability: &str, payload: &str) -> Result<Value> {
    // Parse payload
    let payload_value: Value = serde_json::from_str(payload).context("Invalid JSON payload")?;

    let state = open_file_for_cli(path).await?;

    let file_id = state.file_id.as_ref().unwrap();
    let editor_id = state
        .active_editor_id
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("No active editor"))?;

    let handle = state.engine_manager.get_engine(file_id).unwrap();

    // Create command
    let cmd = Command::new(
        editor_id.clone(),
        capability.to_string(),
        block_id.to_string(),
        payload_value,
    );

    // Execute command
    let events = handle
        .process_command(cmd)
        .await
        .map_err(|e| anyhow::anyhow!("Command failed: {}", e))?;

    // Save the file to persist changes
    if let Some(archive) = &state.archive {
        archive
            .save(Path::new(path))
            .map_err(|e| anyhow::anyhow!("Failed to save file: {}", e))?;
    }

    // Convert events to JSON
    let event_list: Vec<Value> = events
        .iter()
        .map(|e| {
            serde_json::json!({
                "event_id": e.event_id,
                "entity": e.entity,
                "attribute": e.attribute,
                "value": e.value
            })
        })
        .collect();

    Ok(serde_json::json!({
        "status": "success",
        "capability": capability,
        "block_id": block_id,
        "events_generated": events.len(),
        "events": event_list
    }))
}

async fn handle_editor(action: EditorCommands) -> Result<Value> {
    match action {
        EditorCommands::List { path } => {
            let state = open_file_for_cli(&path).await?;

            let file_id = state.file_id.as_ref().unwrap();
            let handle = state.engine_manager.get_engine(file_id).unwrap();
            let editors = handle.get_all_editors().await;

            let editor_list: Vec<Value> = editors
                .iter()
                .map(|(id, editor)| {
                    serde_json::json!({
                        "editor_id": id,
                        "name": editor.name,
                        "editor_type": format!("{:?}", editor.editor_type)
                    })
                })
                .collect();

            Ok(serde_json::json!({
                "path": path,
                "count": editors.len(),
                "editors": editor_list
            }))
        }
    }
}

async fn handle_grant(action: GrantCommands) -> Result<Value> {
    match action {
        GrantCommands::List { path } => {
            let state = open_file_for_cli(&path).await?;

            let file_id = state.file_id.as_ref().unwrap();
            let handle = state.engine_manager.get_engine(file_id).unwrap();
            let grants = handle.get_all_grants().await;

            // grants is HashMap<String, Vec<(String, String)>> where key is editor_id
            // and value is Vec<(cap_id, block_id)>
            let mut grant_list: Vec<Value> = Vec::new();
            for (editor_id, caps) in grants.iter() {
                for (cap_id, block_id) in caps {
                    grant_list.push(serde_json::json!({
                        "editor_id": editor_id,
                        "cap_id": cap_id,
                        "block_id": block_id
                    }));
                }
            }

            Ok(serde_json::json!({
                "path": path,
                "count": grant_list.len(),
                "grants": grant_list
            }))
        }
        GrantCommands::Check {
            path,
            editor_id,
            block_id,
            cap_id,
        } => {
            let state = open_file_for_cli(&path).await?;

            let file_id = state.file_id.as_ref().unwrap();
            let handle = state.engine_manager.get_engine(file_id).unwrap();

            let has_permission = handle
                .check_grant(editor_id.clone(), cap_id.clone(), block_id.clone())
                .await;

            Ok(serde_json::json!({
                "editor_id": editor_id,
                "cap_id": cap_id,
                "block_id": block_id,
                "has_permission": has_permission
            }))
        }
    }
}

async fn handle_event(action: EventCommands) -> Result<Value> {
    match action {
        EventCommands::List { path, limit } => {
            let state = open_file_for_cli(&path).await?;

            let file_id = state.file_id.as_ref().unwrap();
            let handle = state.engine_manager.get_engine(file_id).unwrap();
            let mut events = handle
                .get_all_events()
                .await
                .map_err(|e| anyhow::anyhow!(e))?;

            // Apply limit if specified
            if let Some(limit) = limit {
                events.truncate(limit);
            }

            let event_list: Vec<Value> = events
                .iter()
                .map(|e| {
                    serde_json::json!({
                        "event_id": e.event_id,
                        "entity": e.entity,
                        "attribute": e.attribute,
                        "value": e.value,
                        "timestamp": e.timestamp
                    })
                })
                .collect();

            Ok(serde_json::json!({
                "path": path,
                "count": event_list.len(),
                "events": event_list
            }))
        }
    }
}

async fn handle_pty(action: PtyCommands) -> Result<Value> {
    match action {
        PtyCommands::Init {
            block_id,
            cols,
            rows,
            cwd,
        } => {
            // PTY operations require Tauri's managed state
            // For CLI, we return a not-supported message
            Ok(serde_json::json!({
                "status": "not_supported",
                "reason": "PTY operations require the GUI application",
                "block_id": block_id,
                "cols": cols,
                "rows": rows,
                "cwd": cwd
            }))
        }
        PtyCommands::Write { block_id, data } => Ok(serde_json::json!({
            "status": "not_supported",
            "reason": "PTY operations require the GUI application",
            "block_id": block_id,
            "data": data
        })),
        PtyCommands::Resize {
            block_id,
            cols,
            rows,
        } => Ok(serde_json::json!({
            "status": "not_supported",
            "reason": "PTY operations require the GUI application",
            "block_id": block_id,
            "cols": cols,
            "rows": rows
        })),
        PtyCommands::Close { block_id } => Ok(serde_json::json!({
            "status": "not_supported",
            "reason": "PTY operations require the GUI application",
            "block_id": block_id
        })),
    }
}
