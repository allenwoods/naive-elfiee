# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Elfiee** (Event-sourcing Literate programming Format Integrated Editing Environment) is a block-based editor for the `.elf` file format. The system is built on three core principles:

1. **Block-based Editing**: Files are composed of versioned, typed blocks (markdown, code, diagrams)
2. **Event Sourcing**: All changes captured as immutable event log with complete history
3. **Capability-based Architecture**: Dynamic functionality via "Capabilities" (e.g., `markdown.write`, `code.execute`)

## Technology Stack

This project uses **Tauri 2** (Rust backend + React frontend) for cross-platform desktop application development.

- **Backend**: Rust (Tauri) for native performance and system integration
- **Frontend**: React + TypeScript with Vite for fast development
- **IPC**: Tauri's command system for frontend-backend communication

## Architecture Overview

### Core Data Models (Part 1)

The system uses strongly-typed entities:

- **Block**: Fundamental content unit with `block_id`, `block_type`, `contents` (JSON), and `children` (relation graph)
- **Editor**: User or agent with `editor_id` representing system actors
- **Capability**: Defines actions with `certificator` (authorization check) and `handler` (execution logic)
- **CapabilitiesGrant**: CBAC table mapping `editor_id` + `cap_id` + `block_id` for permissions

### Event Structure (Part 2 - EAVT)

All state changes stored as Events in `_eventstore.db`:

- **Entity**: ID of changed entity (block_id/editor_id)
- **Attribute**: Change descriptor `"{editor_id}/{cap_id}"`
- **Value**: JSON payload (delta or full state)
- **Timestamp**: Vector clock `Record<editor_id, transaction_count>` for conflict resolution

Event types:
- Block events: `create`, `write`, `link` (content/structure changes)
- Editor events: `grant`, `revoke` (permission changes)

### File Format (Part 3)

`.elf` files are ZIP archives containing:

```
example.elf/
├── _eventstore.db       # Canonical event log (SQLite)
├── _snapshot            # Cached markdown preview
├── _blocks_hash         # Cache: block_id → hash mapping
├── _blocks_relation     # Cache: Block.children graph
└── block-{uuid}/        # Per-block asset directories
    ├── body.md
    └── src/
```

### Extension Interface (Part 4)

Extensions add functionality by defining:

1. **Payload Schema**: JSON Schema for `Block.contents`
2. **Relation Types**: Custom relation strings for `Block.children`
3. **Abstract Method**: Renderer `(block: Block) => string` for `_snapshot`
4. **Capability Handlers**: Map of `cap_id` → `{handler, certificator}`

Extensions inherit core capabilities: `core.link`, `core.delete`, `core.grant`.

### Elfile Engine (Part 5)

**Actor Model** (REQUIRED for MVP): Each `.elf` file has a dedicated engine actor processing commands serially via tokio channels.

**Why Actor Model**:
- Multiple `.elf` files open simultaneously
- Multiple users editing same file concurrently
- Serialized command processing eliminates race conditions
- Conflict detection via vector clocks
- EngineManager orchestrates all file actors

**Command Processing Workflow**:
1. Receive `Command` from mailbox (mpsc channel)
2. Load `Capability`, `Block`, `Editor` from state projection
3. **Authorize**: Call `Capability.certificator()` → reject if fail
4. **Execute**: Call `Capability.handler()` → rollback if fail
5. **Receive Events**: Handler returns timestamped `Event[]`
6. **Conflict Check**: Compare vector clocks → reject if stale
7. **Commit**: Atomic append to `_eventstore.db` (RwLock)
8. **Project**: Apply events to in-memory state
9. **Notify**: Broadcast `"state_changed"` to all connected clients (future)

### Elfiee App Interface (Part 6)

**GUI Required** for:
- WYSIWYG rendering of rich content (diagrams, formatted text)
- Drag-and-drop block manipulation
- Interactive knowledge graph visualization
- Visual CBAC permission management
- Real-time collaboration indicators

**Architecture**:
- **Frontend (UI)**: Sends `Command` intents, renders state projections
- **Backend (Engine)**: Processes commands, commits events, broadcasts authoritative state
- UI never modifies local state directly; it only renders engine-pushed state

## Development Workflow

### Setting Up

```bash
# Install frontend dependencies
pnpm install

# Install Rust toolchain (if not already installed)
# Visit https://rustup.rs/ or run:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Run development server
pnpm tauri dev

# Build production app
pnpm tauri build
```

### Common Tasks

Since this is a greenfield project, initial development tasks will include:

**Backend (Rust/Tauri - `src-tauri/src/`)**:
- Implement event store module (SQLite wrapper for `_eventstore.db`)
- Build state projector (event replay → in-memory Block/Editor state)
- Create engine actor with tokio channels (mailbox pattern)
- Implement engine manager for multi-file orchestration
- Implement ZIP archive handler for `.elf` format using `zip` crate
- Expose Tauri commands for frontend IPC

**Extension System (Rust)**:
- Design capability trait with `certificator` and `handler`
- Implement core capabilities: `core.create`, `core.link`, `core.delete`, `core.grant`
- Build capability registry for handler lookup
- Compile-time registration (no dynamic loading for MVP)

**Frontend (React - `src/`)**:
- Multi-file state management (zustand with file-scoped state)
- Implement Command builder and sender via Tauri IPC
- Create base `BlockComponent` with shadcn cards
- Tabbed interface for switching between open files
- Listen for state updates from backend via Tauri events (future)

### Testing

Recommended test structure:
- **Unit tests**: Individual capability handlers, state projector logic
- **Integration tests**: Full command → event → state projection cycle
- **Conflict tests**: Concurrent editor scenarios with vector clock resolution

## Key Implementation Notes

1. **Idempotency**: Commands use `cmd_id` (UUID) to prevent duplicate processing
2. **Conflict Resolution**: Optimistic concurrency with vector clocks; reject and force re-base on conflict
3. **State Projection**: Engine maintains authoritative in-memory state by replaying all events from `_eventstore.db`
4. **Caching**: `_snapshot`, `_blocks_hash`, `_blocks_relation` are derived data; `_eventstore.db` is source of truth
5. **Multi-file Support**: Each open `.elf` spawns a separate engine actor managed by "Elfin" orchestrator

## File Organization

```
naive-elfiee/
├── README.md              # Full engineering specification
├── CLAUDE.md              # This file
├── package.json           # Frontend dependencies
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript configuration
├── index.html             # App entry point
├── .cursor/mcp.json       # Shadcn MCP server config
├── src/                   # React frontend
│   ├── main.tsx           # React entry point
│   ├── App.tsx            # Main app component
│   ├── components/        # React components
│   │   └── BlockComponent.tsx
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Frontend utilities
│   └── types/             # TypeScript type definitions
├── src-tauri/             # Tauri/Rust backend
│   ├── Cargo.toml         # Rust dependencies
│   ├── tauri.conf.json    # Tauri app configuration
│   ├── build.rs           # Build script
│   └── src/
│       ├── main.rs        # Tauri setup and commands
│       ├── lib.rs         # Library root
│       ├── engine/        # Elfile Engine
│       │   ├── mod.rs
│       │   ├── event_store.rs
│       │   ├── state_projector.rs
│       │   └── command_processor.rs
│       ├── models/        # Core data models
│       │   ├── block.rs
│       │   ├── editor.rs
│       │   ├── capability.rs
│       │   └── event.rs
│       ├── extensions/    # Extension system
│       │   ├── mod.rs
│       │   └── core.rs
│       └── utils/         # Backend utilities
└── public/                # Static assets
```

## Tauri-Specific Implementation

### Backend (Rust)

**Key Crates**:
- `sqlx`: SQLite interface for event store
- `serde`, `serde_json`: JSON serialization for events/commands
- `uuid`: Generate block_id, event_id, etc.
- `zip`: Handle `.elf` archive reading/writing
- `tokio`: Async runtime for actor model (REQUIRED)
- `dashmap`: Concurrent hashmap for engine manager

**Tauri Commands** (exposed to frontend):
```rust
#[tauri::command]
async fn execute_command(cmd: Command) -> Result<Event[], String>

#[tauri::command]
async fn get_block_state(block_id: String) -> Result<Block, String>

#[tauri::command]
async fn open_elf_file(path: String) -> Result<FileHandle, String>
```

**Tauri Events** (pushed to frontend):
- `state_changed`: Broadcast when engine commits events
- `command_rejected`: When authorization fails
- `command_failed`: When execution fails

### Frontend (React)

**Key Libraries**:
- `@tauri-apps/api`: Tauri IPC bindings
- `react-dnd` or `@dnd-kit/core`: Drag-and-drop for blocks
- `zustand` or `jotai`: Lightweight state management
- `react-query`: Cache and sync state from backend

**Communication Pattern**:
```typescript
// Send command to backend
import { invoke } from '@tauri-apps/api/core';
await invoke('execute_command', { cmd: commandObject });

// Listen for state updates
import { listen } from '@tauri-apps/api/event';
listen('state_changed', (event) => {
  // Update UI with event.payload
});
```

### TypeScript Bindings Generation (CRITICAL)

**HARD RULE**: `src/bindings.ts` is AUTO-GENERATED by tauri-specta. NEVER modify it manually.

**Correct Workflow**:
1. Add/modify Tauri commands in Rust (`src-tauri/src/commands/*.rs`)
2. Register commands in `src-tauri/src/lib.rs` (both debug and release handlers)
3. Run `pnpm tauri dev` or `cargo build` in `src-tauri/` to regenerate bindings
4. The bindings file will be automatically updated at `src/bindings.ts`

**Why This Matters**:
- Manual edits will be overwritten on next build
- Type safety depends on matching Rust command signatures
- Specta ensures frontend-backend type consistency

**If you need to modify bindings**:
- Change the Rust source code (add #[specta] to commands, update model types)
- Rebuild to regenerate bindings.ts
- DO NOT edit bindings.ts directly

### Capability Payload Types (CRITICAL)

**HARD RULE**: For every capability that accepts input, define a typed Rust payload struct with `#[derive(Serialize, Deserialize, Type)]`. NEVER use manual JSON parsing in handlers or manual TypeScript interfaces in frontend.

**Why This Matters**:
- Manual frontend interfaces can drift from backend expectations
- Leads to runtime errors like "Missing 'content' in payload"
- tauri-specta ensures compile-time consistency between frontend and backend
- TypeScript will catch mismatches immediately during development

**Correct Pattern**:
1. Define payload struct in extension's `mod.rs` (NOT in `models/payloads.rs` unless it's a core capability)
2. Add `#[derive(Serialize, Deserialize, Type)]`
3. Export from extension module
4. Use in capability handler with `serde_json::from_value(cmd.payload.clone())`
5. Frontend automatically gets TypeScript type in `bindings.ts` after running `pnpm tauri dev`

**Example**:
```rust
// Backend: src/extensions/markdown/mod.rs
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MarkdownWritePayload {
    pub content: String,  // Direct string, NOT nested object
}

// In handler
use super::MarkdownWritePayload;
let payload: MarkdownWritePayload = serde_json::from_value(cmd.payload.clone())
    .map_err(|e| format!("Invalid payload: {}", e))?;
```

Frontend automatically gets:
```typescript
// Auto-generated in bindings.ts
export type MarkdownWritePayload = { content: string }
```

**Payload Location Rules**:
- **Extension-specific** payloads: Define in `src/extensions/{extension_name}/mod.rs`
- **Core** payloads (grant, revoke, link): Define in `src/models/payloads.rs`

This keeps extensions modular and self-contained.

**See Documentation**:
- `docs/extension_development.md` → "Payload 类型定义（强类型方案）" section
- `docs/guides/FRONTEND_DEVELOPMENT.md` → "Capability Payload Types" section

### Development Commands

```bash
# Run dev server (hot reload for frontend and backend)
pnpm tauri dev

# Build frontend only
pnpm run build

# Build full Tauri app
pnpm tauri build

# Run Rust tests
cd src-tauri && cargo test

# Run frontend tests
pnpm test

# Format Rust code
cd src-tauri && cargo fmt

# Lint Rust code
cd src-tauri && cargo clippy
```

### Part 4: Extension Interface & CBAC

**Capability System** implemented with procedural macros:

- **CapabilityRegistry**: Central registry for all capability handlers
- **GrantsTable**: CBAC authorization table projected from grant/revoke events
- **Procedural Macro**: `#[capability(id = "...", target = "...")]` for capability definitions

**Authorization Model**:
1. **Owner Always Authorized**: Block owners can perform any capability
2. **Grant-Based**: Non-owners need explicit grants in GrantsTable
3. **Wildcard Grants**: `block_id = "*"` grants permission on all blocks

**Event Attribute Format**: `{editor_id}/{cap_id}` (e.g., "alice/markdown.write")

**Extension System**:
- Extensions live in `src/extensions/`
- Each extension provides capabilities for specific block types
- Example: Markdown extension with `markdown.write` and `markdown.read`

**Creating Extensions**:
1. Create directory in `src/extensions/my_extension/`
2. Define capabilities using `#[capability]` macro
3. Register in `CapabilityRegistry::register_extensions()`
4. Add comprehensive tests including authorization checks

See `src-tauri/docs/guides/EXTENSION_DEVELOPMENT.md` for complete guide.

**Built-in Capabilities**:
- `core.create`: Create new blocks with full initial state
- `core.link`: Add relations between blocks
- `core.unlink`: Remove relations between blocks
- `core.delete`: Soft-delete blocks
- `core.grant`: Grant capabilities to editors
- `core.revoke`: Revoke capabilities from editors

**Extension Capabilities** (Markdown):
- `markdown.write`: Write markdown content to markdown blocks
- `markdown.read`: Read markdown content from markdown blocks

## Documentation References

For detailed guidance on specific topics, consult these documentation files:

### Extension Development
**`docs/extension_development.md`** - Complete guide to creating capabilities and extensions
- How to define capabilities with the `#[capability]` macro
- **Payload 类型定义（强类型方案）** section (CRITICAL for type safety)
- Authorization patterns and CBAC implementation
- Testing strategies for capabilities
- Example: Markdown extension walkthrough

### Frontend Development
**`docs/guides/FRONTEND_DEVELOPMENT.md`** - Type-safe Tauri frontend development
- tauri-specta workflow and bindings generation
- **Capability Payload Types** section (CRITICAL - prevents frontend/backend mismatches)
- Type mappings between Rust and TypeScript
- Common pitfalls and how to avoid them
- Best practices for using auto-generated bindings

### Critical Reading

**Before creating any capability**: Read the Payload Types sections in both documents above to avoid frontend-backend type mismatches that lead to runtime errors.

**Before editing `src/bindings.ts`**: DON'T! Read "TypeScript Bindings Generation" section above.

**Before implementing CBAC**: Read the Extension Development guide's authorization section.
