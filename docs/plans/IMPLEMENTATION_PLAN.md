# Elfiee Tauri Implementation Plan

This document provides the master overview of the Elfiee implementation. Each part has its own detailed guide.

## Implementation Philosophy

1. **No Over-Engineering**: Build the simplest thing that works. Optimize only when needed.
2. **Clear Over Clever**: Readability is the top priority. This is MVP phase.
3. **Minimal UI First**: Leverage shadcn components for a clean, functional interface.
4. **Test-Driven Development (TDD)**: Write tests first, then implement. Each part includes test examples - follow them.
5. **Commit After Each Part**: Once a part is complete and tests pass, commit with a short summary (e.g., "Part 1: Core models with serde").

## Project Structure

```
naive-elfiee/
├── src/                       # React frontend
│   ├── components/            # UI components (shadcn)
│   ├── lib/                   # Utilities (Tauri client)
│   ├── store/                 # State management (zustand)
│   └── types/                 # TypeScript definitions
└── src-tauri/src/             # Rust backend
    ├── models/                # Core data structures
    ├── engine/                # Event store & processor
    ├── elf/                   # .elf file format handler
    ├── capabilities/          # Extension system
    ├── commands/              # Tauri IPC commands
    └── main.rs                # Tauri app entry
```

## Implementation Parts

Follow these guides in order. Each part is self-contained with clear steps, code examples, and tests.

### [Part 1: Core Data Models](./part1-core-models.md)

**What**: Define fundamental data structures (Block, Editor, Capability, Command, Event)

**Time**: 1 week

**Key Deliverables**:
- ✅ Rust structs with serde serialization
- ✅ TypeScript type definitions
- ✅ Basic constructors (no validation yet)

**Start here**: This is the foundation. No dependencies on other parts.

**Commit message example**: `Part 1: Core data models with serde`

---

### [Part 2: Event Structure](./part2-event-structure.md)

**What**: Implement SQLite event store using EAVT schema

**Time**: 1 week

**Key Deliverables**:
- ✅ SQLite database with EAVT table
- ✅ Append events atomically
- ✅ Query by entity and retrieve all events
- ✅ Basic test coverage

**Depends on**: Part 1 (uses Event model)

**Commit message example**: `Part 2: SQLite event store with EAVT schema`

---

### [Part 3: ELF File Format](./part3-elf-file-format.md)

**What**: Handle .elf files as ZIP archives

**Time**: 3-4 days

**Key Deliverables**:
- ✅ Extract ZIP to temp directory
- ✅ Access event store and block assets
- ✅ Re-zip and save

**Depends on**: Part 2 (uses EventStore)

**Deferred**: `_snapshot`, `_blocks_hash`, `_blocks_relation` caches (optimize later)

**Commit message example**: `Part 3: ZIP-based .elf file format handler`

---

### [Part 4: Extension Interface](./part4-extension-interface.md)

**What**: Capability system for extending block types

**Time**: 1 week

**Key Deliverables**:
- ✅ `CapabilityHandler` trait
- ✅ Capability registry
- ✅ Built-in capabilities: `core.create`, `core.link`, `core.delete`, `core.grant`
- ✅ Example: `markdown.write`

**Depends on**: Part 1 (uses models)

**Design**: Tauri-command-style - simple functions with trait that provides authorization automatically

**Commit message example**: `Part 4: Capability system with core handlers`

---

### [Part 5: Elfile Engine](./part5-elfile-engine.md)

**What**: Command processor with state projection

**Time**: 1.5 weeks

**Key Deliverables**:
- ✅ State projector (replay events → in-memory state)
- ✅ Command processor (authorize → execute → commit)
- ✅ Vector clock updates
- ✅ Basic tests

**Depends on**: Parts 2, 4 (uses EventStore, CapabilityRegistry)

**What's Included**: Actor model with tokio, engine manager, conflict detection

**Commit message example**: `Part 5: Engine actor with tokio and conflict detection`

---

### [Part 6: Tauri App Interface](./part6-tauri-app.md)

**What**: Connect Rust backend to React frontend

**Time**: 1.5 weeks

**Key Deliverables**:
- ✅ Tauri commands (file ops, block ops)
- ✅ App state management
- ✅ React UI with shadcn components
- ✅ Basic block visualization
- ✅ Create and view blocks

**Depends on**: Parts 3, 5 (uses ElfArchive, EngineManager)

**Commit message example**: `Part 6: Tauri app with multi-file tabbed UI`

---

## Timeline Summary

| Part | Time | Cumulative |
|------|------|------------|
| Part 1: Core Models | 1 week | 1 week |
| Part 2: Event Store | 1 week | 2 weeks |
| Part 3: ELF Format | 3-4 days | 3 weeks |
| Part 4: Extensions | 1 week | 4 weeks |
| Part 5: Engine | 1.5 weeks | 5.5 weeks |
| Part 6: Tauri App | 1.5 weeks | **7 weeks** |

**MVP Target**: 7 weeks (functional block editor with persistence)

## What's Included in MVP

✅ **Core Functionality**:
- Create and open `.elf` files
- Add blocks (any type)
- Link blocks together
- View all blocks in UI
- All changes persisted to event store
- Basic authorization (block owner can do anything)

✅ **Technical**:
- Event sourcing with full history
- Capability-based extension system
- ZIP-based file format
- Tauri IPC between Rust/React

## What's NOT in MVP (Add Later)

❌ **Advanced Features**:
- Rich text editors for specific block types
- Drag-and-drop UI
- Permission management UI
- Real-time event broadcasting (Tauri events)
- Snapshot caching (`_snapshot`, `_blocks_hash`)
- Graph visualization

❌ **Optimizations**:
- Connection pooling
- Incremental ZIP updates
- Advanced conflict merging (currently: reject on conflict)

## Getting Started

1. **Read the spec**: Review `../../README.md` for architectural context
2. **Start with Part 1**: Follow `./part1-core-models.md`
3. **Follow TDD**: Write tests first (examples provided), then implement
4. **Test as you go**: Run `cargo test` after each step - all tests must pass
5. **Commit after completion**: When a part is done, commit with format: `Part X: <short summary>`
6. **Keep it simple**: Resist the urge to optimize or add features

## TDD Workflow (Per Part)

```bash
# 1. Write the test (examples in each part)
# 2. Run test - it should fail
cargo test

# 3. Implement the minimum code to pass
# 4. Run test - it should pass
cargo test

# 5. Refactor if needed (keep it simple!)
# 6. Commit
git add .
git commit -m "Part X: <what you implemented>"
```

## Development Commands

```bash
# Backend
cd src-tauri
cargo build          # Compile
cargo test           # Run tests
cargo fmt            # Format code
cargo clippy         # Lint

# Frontend
pnpm install         # Install dependencies
pnpm tauri dev       # Run dev server
pnpm tauri build     # Build production app

# Full stack
pnpm tauri dev       # Runs both frontend and backend
```

## Success Criteria

After completing all 6 parts, you should be able to:

1. **Create a new `.elf` file**
2. **Add several blocks** with different names
3. **Link blocks together** using `core.link`
4. **Close and reopen the file** - all data persists
5. **View block relationships** in the UI
6. **Check the SQLite database** - see all events in EAVT format

If all of the above work, **MVP is complete**! 🎉

## What's Next (Post-MVP)

Once MVP is stable, prioritize these enhancements based on user feedback:

1. **Markdown editor** - Add rich editing for markdown blocks
2. **Drag-and-drop** - Visual block linking
3. **Permission UI** - Manage grants visually
4. **Graph view** - Visualize block relationships
5. **Export** - Generate consolidated markdown from `_snapshot`
6. **Multi-user** - Real-time collaboration with conflict resolution

## Questions & Issues

- **Rust questions**: Check `src-tauri/Cargo.toml` for dependencies or ask context7 MCP
- **React questions**: Use shadcn docs (https://ui.shadcn.com) or use Shadcn MCP
- **Tauri questions**: Check Tauri v2 docs (https://tauri.app/v2/) or ask context7 MCP
- **Architecture questions**: See `../README.md` and `../CLAUDE.md`

---

**Remember**: Build the simplest thing that works. You can always refactor later. Good luck! 🚀
