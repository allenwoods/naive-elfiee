# Gemini Project Context: Elfiee

This document provides essential context for the Elfiee project, a block-based editor built with Tauri, React, and Rust.

## Project Overview

Elfiee (Event-sourcing Literate programming Format Integrated Editing Environment) is a desktop application for editing `.elf` files. It's designed around three core principles:

1.  **Block-based Editing:** Content is structured as versioned, typed blocks (e.g., markdown, code).
2.  **Event Sourcing:** All changes are recorded as an immutable log of events, providing a robust history.
3.  **Capability-based Architecture:** Features are defined as "Capabilities" that can be granted to users or agents.

The application consists of a Rust backend (the "Elfile Engine") that manages file state and a React/TypeScript frontend for the user interface. The backend and frontend communicate via the Tauri bridge.

The `.elf` file format itself is a Zip archive containing an SQLite database for the event log (`_eventstore.db`) and other assets.

For a detailed understanding of the architecture, refer to the documents in the `docs/plans/` directory, especially `IMPLEMENTATION_PLAN.md`.

## Development Setup

The project uses `pnpm` for frontend package management and `cargo` for the Rust backend.

### Prerequisites

*   Node.js and pnpm
*   Rust and Cargo
*   Tauri development prerequisites (see [Tauri documentation](https://tauri.app/v1/guides/getting-started/prerequisites))

### Running the Application

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Run the development server:**
    This command will start the Vite dev server for the frontend and build/launch the Tauri application.
    ```bash
    pnpm tauri dev
    ```

### Build and Preview

*   **Build the application for production:**
    ```bash
    pnpm tauri build
    ```

*   **Preview the production build:**
    ```bash
    pnpm preview
    ```

## Key Technologies & Libraries

### Frontend (`src/`)

*   **Framework:** React 18
*   **Language:** TypeScript
*   **Build Tool:** Vite
*   **Desktop Bridge:** `@tauri-apps/api`
*   **UI Components:** shadcn
*   **State Management:** zustand (recommended)

### Backend (`src-tauri/`)

*   **Framework:** Tauri 2
*   **Language:** Rust
*   **Async Runtime:** Tokio
*   **Database:** `rusqlite` for SQLite event store.
*   **Serialization:** `serde`, `serde_json`
*   **File Handling:** `zip` for the `.elf` format.
*   **Concurrency:** `dashmap`

## Project Structure

*   `src/`: Contains the React/TypeScript frontend code.
*   `src-tauri/`: Contains the Rust backend code.
    *   `src/engine`: The Elfile Engine, including event store, state projection, and command processing.
    *   `src/models`: Core data models (Block, Editor, Event, etc.).
    *   `src/extensions`: Capability extensions.
*   `docs/plans/`: Detailed architecture and design documents.
*   `CLAUDE.md`: The primary guide for development, containing detailed architectural and implementation notes.
*   `package.json`: Defines frontend dependencies and scripts.
*   `src-tauri/Cargo.toml`: Defines backend (Rust) dependencies.

## Testing and Formatting

*   **Run Rust tests:**
    ```bash
    cd src-tauri && cargo test
    ```

*   **Format Rust code:**
    ```bash
    cd src-tauri && cargo fmt
    ```

*   **Lint Rust code:**
    ```bash
    cd src-tauri && cargo clippy
    ```

*   **Run frontend tests:**
    ```bash
    pnpm test
    ```

## Development Conventions

*   The project follows standard Rust and TypeScript/React conventions.
*   The backend architecture is based on the Actor Model, where each open file is managed by its own engine instance.
*   All backend logic is driven by a command-event flow, as detailed in the `README.md`.

## Vite Configuration for Tauri

The `vite.config.ts` file has some specific configurations for Tauri development:

*   `clearScreen: false`: This is set to `false` to prevent Vite from clearing the screen and obscuring potential Rust errors from the Tauri backend.
*   `server.port: 1420`: The development server is configured to run on port 1420, as expected by Tauri.
*   `server.watch.ignored`: The `src-tauri` directory is ignored by Vite's file watcher to prevent unnecessary reloads.

## TypeScript Configuration

The `tsconfig.json` file is configured with `strict: true`, enforcing strong type-checking. Key linting rules enabled include:

*   `noUnusedLocals`: Reports unused local variables.
*   `noUnusedParameters`: Reports unused parameters.
*   `noFallthroughCasesInSwitch`: Prevents fall-through cases in switch statements.
