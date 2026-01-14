# ⚡ CRITICAL RULES (AI MUST OBEY)

> These are HARD CONSTRAINTS. Violating them will break the application.

## 🔴 Front-End Prohibitions (React/Zustand)

1.  **NO `TauriClient` in Components**: 
    *   ❌ NEVER import or use `TauriClient` directly in React components (`.tsx`).
    *   ✅ ALWAYS use `useAppStore` hooks. Components only trigger Actions.
2.  **NO Manual Edits to `bindings.ts`**:
    *   ❌ NEVER edit `src/bindings.ts`. It is auto-generated.
    *   ✅ Edit Rust structs and add `#[derive(Type)]` if types are missing.
3.  **NO Direct State Mutation**:
    *   ❌ NEVER mutate state objects (e.g., `block.content = '...'`).
    *   ✅ ALWAYS use Actions (e.g., `updateBlock(id, content)`).

## 🔴 Back-End Prohibitions (Rust/Tauri)

1.  **NO Manual Extension Creation**:
    *   ❌ NEVER create extension files manually if `elfiee-ext-gen` can do it.
    *   ✅ ALWAYS use `elfiee-ext-gen create` to scaffold new extensions or capabilities.
2.  **NO Missing Registrations**:
    *   ❌ NEVER add a command/type without registering it in `src-tauri/src/lib.rs`.
    *   ✅ MUST register in **BOTH** `cfg(debug_assertions)` AND `cfg(not(debug_assertions))` blocks.
3.  **NO Raw JSON Access**:
    *   ❌ NEVER use `cmd.payload.get("field")`.
    *   ✅ ALWAYS define a struct with `#[derive(Type, Serialize, Deserialize)]` and use `serde_json::from_value`.
4.  **NO State Mutation without Events**:
    *   ❌ NEVER modify `Block` structs directly in handlers.
    *   ✅ ALWAYS return `Vec<Event>` using `create_event()`.

## 🔴 Architecture Constraints

1.  **Entity ID Rule**:
    *   **Write Capability**: `Event.entity` MUST be `block_id` (The object being modified).
    *   **Read Capability**: `Event.entity` MUST be `editor_id` (The actor reading the data).
