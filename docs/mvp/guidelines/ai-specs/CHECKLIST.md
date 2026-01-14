# 📋 AI Development Checklist (Rule Patterns)

> Modelled after `elfiee-ext-gen/rules/`. AI must verify code against these patterns before submitting.

## 🔍 Frontend Verification Patterns

| Pattern to Detect (Violations) | Category | Correct Pattern / Hint |
|:---|:---|:---|
| `import { TauriClient } from '@/lib/tauri-client'` in `*.tsx` | architectural_violation | Import `useAppStore` instead. Components trigger actions. |
| `import { commands } from '@/bindings'` in `*.tsx` | architectural_violation | Components MUST NOT call raw IPC commands. Use Store Actions. |
| `state.property = value` (Direct assignment) | state_mutation_error | Use `set({ property: value })` or specific Action logic. |
| Manual changes in `src/bindings.ts` | build_system_violation | Edit Rust structs + `#[derive(Type)]` then run `pnpm tauri dev`. |
| Missing `try-catch` in async UI handlers | error_handling_gap | Always wrap Store Action calls in try-catch for Toast feedback. |

## 🔍 Backend Verification Patterns

| Pattern to Detect (Violations) | Category | Correct Pattern / Hint |
|:---|:---|:---|
| Command registered ONLY in `debug_assertions` block | registration_error | Must be registered in BOTH debug and release handler blocks. |
| `serde_json::Value` usage for capability payload | type_safety_gap | Define a struct with `#[derive(Type, Serialize, Deserialize)]`. |
| `create_event(block_id, ...)` in a Read Capability | entity_id_error | Read capabilities MUST use `editor_id` as the entity. |
| `create_event(editor_id, ...)` in a Write Capability | entity_id_error | Write capabilities MUST use `block_id` as the entity. |
| Direct modification of `Block` fields in handlers | state_mutation_error | Return `Ok(vec![event])`. State is derived from events. |
| New capability added without `elfiee-ext-gen` | workflow_violation | Use `elfiee-ext-gen create` to ensure TDD and auto-registration. |

## 🔍 Workflow Verification Patterns

| Stage | Requirement | Pattern to Check |
|:---|:---|:---|
| **Start** | Tooling | Did I run `cargo install --path elfiee-ext-gen --force` if tool is missing? |
| **Development** | TDD | Are there failing tests in `tests.rs` before implementation? |
| **Review** | Validation | Did I run `elfiee-ext-gen validate <ext>`? |
| **Types** | Sync | Did I run `pnpm tauri dev` or `cargo build` to update `bindings.ts`? |
