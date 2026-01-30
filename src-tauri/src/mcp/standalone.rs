//! Standalone MCP Server Entry Point
//!
//! Provides the `elfiee mcp-server --elf {path}` command that runs an MCP server
//! as an independent process without the GUI.
//!
//! This is used by `agent.enable` which injects the following config into
//! `.claude/mcp.json`:
//! ```json
//! {
//!   "mcpServers": {
//!     "elfiee": {
//!       "command": "elfiee",
//!       "args": ["mcp-server", "--elf", "/path/to/project.elf"]
//!     }
//!   }
//! }
//! ```
//!
//! The server communicates via stdin/stdout using the standard MCP JSON-RPC protocol.

use crate::engine::standalone::create_standalone_engine;
use crate::mcp::peer_registry::PeerRegistry;
use crate::mcp::stdio_transport::start_stdio_server;
use crate::mcp::ElfieeMcpServer;
use std::path::PathBuf;

/// Run the standalone MCP server.
///
/// This is the main entry point for `elfiee mcp-server --elf {path}`.
/// It:
/// 1. Opens the .elf file and creates a standalone Engine (with WAL mode)
/// 2. Creates the MCP server with the standalone AppState
/// 3. Starts the stdio transport (reads from stdin, writes to stdout)
/// 4. Blocks until the client disconnects
///
/// # Arguments
/// * `elf_path` - Path to the .elf file to serve
///
/// # Returns
/// * `Ok(())` on clean shutdown
/// * `Err(String)` on failure
pub async fn run_mcp_server(elf_path: PathBuf) -> Result<(), String> {
    // Validate the .elf file exists
    if !elf_path.exists() {
        return Err(format!(
            "File not found: {}. Please provide a valid .elf file path.",
            elf_path.display()
        ));
    }

    if !elf_path.extension().map_or(false, |ext| ext == "elf") {
        return Err(format!(
            "Not an .elf file: {}. Expected a file with .elf extension.",
            elf_path.display()
        ));
    }

    // Log to stderr (stdout is reserved for MCP JSON-RPC protocol)
    eprintln!("Elfiee MCP Server starting for: {}", elf_path.display());

    // 1. Create standalone engine (opens .elf, enables WAL, creates editor)
    let app_state = create_standalone_engine(&elf_path).await?;

    eprintln!("Engine initialized. Starting MCP stdio transport...");

    // 2. Create MCP server with peer registry
    let registry = PeerRegistry::new();
    let server = ElfieeMcpServer::new(app_state.clone(), registry);

    // 3. Start stdio transport (blocks until client disconnects)
    // The dispatcher is spawned inside start_stdio_server.
    start_stdio_server(server, app_state.clone()).await?;

    // 4. Clean shutdown
    eprintln!("MCP Server shutting down...");
    app_state
        .engine_manager
        .shutdown_all()
        .await
        .map_err(|e| format!("Shutdown error: {}", e))?;

    eprintln!("MCP Server stopped.");
    Ok(())
}

/// Parse CLI arguments for the MCP server subcommand.
///
/// Expected format: `elfiee mcp-server --elf <path>`
///
/// Returns `Some(PathBuf)` if valid MCP server arguments were provided,
/// `None` if the arguments don't match the MCP server subcommand.
pub fn parse_mcp_args(args: &[String]) -> Option<PathBuf> {
    // args[0] is the executable name
    // args[1] should be "mcp-server"
    if args.len() < 2 || args[1] != "mcp-server" {
        return None;
    }

    // Parse --elf <path>
    let mut elf_path: Option<PathBuf> = None;
    let mut i = 2;
    while i < args.len() {
        match args[i].as_str() {
            "--elf" => {
                if i + 1 < args.len() {
                    elf_path = Some(PathBuf::from(&args[i + 1]));
                    i += 2;
                } else {
                    eprintln!("Error: --elf requires a file path argument");
                    return None;
                }
            }
            _ => {
                eprintln!("Unknown argument: {}", args[i]);
                i += 1;
            }
        }
    }

    if elf_path.is_none() {
        eprintln!("Usage: elfiee mcp-server --elf <path>");
        eprintln!("  --elf <path>  Path to the .elf file to serve");
    }

    elf_path
}
