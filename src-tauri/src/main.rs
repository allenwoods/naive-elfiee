// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Check for MCP server subcommand: `elfiee mcp-server --elf <path>`
    let args: Vec<String> = std::env::args().collect();

    if let Some(elf_path) = elfiee_lib::mcp::standalone::parse_mcp_args(&args) {
        // Run standalone MCP server (blocks until client disconnects)
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(async {
            if let Err(e) = elfiee_lib::mcp::run_mcp_server(elf_path).await {
                eprintln!("MCP Server error: {}", e);
                std::process::exit(1);
            }
        });
    } else {
        // Normal GUI mode
        elfiee_lib::run();
    }
}
