# ⚡ CRITICAL DEVELOPMENT RULES (AI MUST READ)

## 🚨 Guidelines & Rules
*   **[Front-End Rules](docs/mvp/guidelines/前端开发规范.md)**: Hard rules for React/Zustand and code patterns.
*   **[Back-End Rules](docs/mvp/guidelines/后端开发规范.md)**: Hard rules for Rust/Tauri, tooling usage, and patterns.
*   **[Workflow](docs/mvp/guidelines/开发流程规范.md)**: Steps for setup, TDD workflow, and committing.

## 🔴 Frontend Hard Rules (React/Zustand)
1.  **NO Direct API Calls in Components**: Components MUST use `useAppStore` Actions. NEVER import `TauriClient` in UI components.
    *   ❌ Bad: `TauriClient.block.create(...)` inside `MyComponent`.
    *   ✅ Good: `const create = useAppStore(s => s.createBlock); create(...)`.
2.  **`bindings.ts` is Read-Only**: NEVER edit this file. It is auto-generated. To fix types, edit Rust structs and add `#[derive(Type)]`.
3.  **State Immutability**: NEVER mutate state objects directly (e.g., `block.content = "..."`). Always use Store Actions which invoke Backend Commands.

## 🔴 Backend Hard Rules (Rust/Tauri)
1.  **Mandatory Tooling**: Use `elfiee-ext-gen create` to scaffold ALL new extensions or capabilities. Follow the TDD workflow it generates.
2.  **Command Registration**: New commands MUST be registered in `src-tauri/src/lib.rs` in **BOTH** `debug_assertions` AND `not(debug_assertions)` blocks.
3.  **Entity ID Rule**:
    *   **Write Capability**: `Event.entity` = `block_id` (The target block being modified).
    *   **Read Capability**: `Event.entity` = `editor_id` (The actor performing the read).
4.  **Payloads**: All capabilities must have a specific struct with `#[derive(Type, Serialize, Deserialize)]`. Do not use `serde_json::Value` manually in handlers.

## 🔄 Workflow
*   **Adding Features**: 1. Define Rust Command/Payload -> 2. Register in `lib.rs` -> 3. Run `pnpm tauri dev` (gens types) -> 4. Create Zustand Action -> 5. Update UI.

---

# Elfiee Project Context

## Project Overview

**Elfiee** is a block-based editor for the `.elf` file format, designed with a focus on literate programming and event sourcing. It allows users to edit documents composed of various block types (markdown, code, diagrams) where every change is captured as an immutable event.

The system is built on a **Capability-based Architecture**, meaning functionality is defined by "Capabilities" (like `markdown.write` or `code.execute`) that are dynamically granted to editors.

**Key Architectural Concepts:**
*   **Block-based Editing:** Content is structured in typed blocks.
*   **Event Sourcing:** All changes are stored as an append-only log of events in a SQLite database within the `.elf` (zip) file.
*   **Actor Model:** Each open file is managed by a dedicated Engine Actor in the backend to handle concurrency and state projection.
*   **CBAC (Capability-Based Access Control):** Granular permission system for editors.

## Tech Stack

### Frontend
*   **Framework:** React (v18)
*   **Language:** TypeScript
*   **Build Tool:** Vite
*   **State Management:** Zustand
*   **Styling:** Tailwind CSS, Shadcn UI, Radix UI
*   **Rendering:** Myst Parser (for markdown/literate programming)

### Backend
*   **Framework:** Tauri v2
*   **Language:** Rust
*   **Database:** SQLite (via `sqlx`)
*   **File Format:** ZIP archive (containing SQLite db and assets)
*   **Type Sharing:** `specta` / `tauri-specta` (generates TS types from Rust structs)

## Project Structure

*   `src/` - Frontend source code (React/TypeScript).
*   `src-tauri/` - Backend source code (Rust).
    *   `src/commands/` - Tauri commands callable from frontend.
    *   `src/models/` - Data models (Block, Event, Editor, etc.).
    *   `src/extensions/` - Built-in extensions and capability implementations.
*   `elfiee-ext-gen/` - A Rust-based CLI tool for scaffolding new extensions.
*   `docs/` - Comprehensive documentation on architecture, migration plans, and concepts.
*   `Makefile` - Automation for development tasks.

## Building and Running

The project uses `make` and `pnpm` for task management.

### Prerequisites
*   Node.js & pnpm
*   Rust (Cargo)

### Key Commands

*   **Start Development Server:**
    ```bash
    make dev
    # or
    pnpm tauri dev
    ```
    This starts the Tauri application with hot-reloading for the frontend.

*   **Run All Tests:**
    ```bash
    make test
    ```
    Runs both Rust backend tests (`cargo test`) and frontend tests (`vitest`).

*   **Format Code:**
    ```bash
    make fmt
    ```
    Formats Rust code (via `rustfmt`) and frontend code (via `prettier`).

*   **Clean Build Artifacts:**
    ```bash
    make clean
    ```

## Development Conventions

*   **Event Sourcing:** State is never mutated directly. Use capabilities to generate events, which are then applied to the state projector.
*   **Type Safety:** Use `tauri-specta` to share types between Rust and TypeScript. Run `cargo test` or `cargo check` to regenerate bindings if Rust types change.
*   **Extensions:** New block types should be implemented as extensions. Use `elfiee-ext-gen` to scaffold them.
*   **Formatting:** Always run `make fmt` before committing.
