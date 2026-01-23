---
name: elfiee-dev
description: Elfiee development rules. MUST read before any development. Contains forbidden actions, API/Capability reference, and development patterns.
---

# Elfiee Development Rules

**CRITICAL**: Violating these rules breaks type safety, event sourcing, or CBAC.

---

## Part 1: Forbidden Actions

| Action | Why Forbidden |
|--------|---------------|
| Edit `src/bindings.ts` | Auto-generated, will be overwritten |
| Use `invoke()` directly | Use `commands` from `@/bindings` |
| Define TS interfaces for payloads | Auto-generated from Rust |
| Modify state without `executeCommand` | Breaks event sourcing |
| Skip capability authorization | Breaks CBAC security |
| Add command without registering in `lib.rs` | Breaks bindings |

---

## Part 2: Frontend Rules

```typescript
// CORRECT
import { commands, Command, MarkdownWritePayload } from '@/bindings'
await commands.executeCommand(fileId, cmd)

// WRONG
import { invoke } from '@tauri-apps/api/core'
interface MarkdownWritePayload { content: string }  // Don't define manually
```

- Use `commands` from `@/bindings` only
- If API missing, **ask user** - don't create workarounds
- Prefer convenience APIs (see Part 4)

---

## Part 3: Backend Rules

### Adding Capability
```rust
// 1. Create in src-tauri/src/extensions/{ext}/{cap_name}.rs
use capability_macros::capability;

#[capability(id = "myext.write", target = "myext")]
fn handle_myext_write(cmd: &Command, block: Option<&Block>) -> CapResult<Vec<Event>> {
    let payload: MyExtWritePayload = serde_json::from_value(cmd.payload.clone())?;
    // ...
}

// 2. Define payload in extension's mod.rs
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MyExtWritePayload { pub content: String }

// 3. Register in src-tauri/src/capabilities/registry.rs
fn register_extensions(&mut self) {
    use crate::extensions::myext::*;
    self.register(Arc::new(MyextWriteCapability));  // Macro generates this struct
}
```

### Adding Tauri Command
1. Create in `src-tauri/src/commands/`, add `#[tauri::command]` + `#[specta::specta]`
2. Register in `src-tauri/src/lib.rs` (debug + release handlers)
3. Run `pnpm tauri dev` to regenerate bindings

---

## Part 4: API vs Capability

| Scenario | Use |
|----------|-----|
| Read data | Direct API (`getBlock`, `getAllBlocks`, etc.) |
| Modify state | `executeCommand` with capability |
| Simple operations | Convenience API (see below) |

### Convenience APIs (prefer these)

Type-safe wrappers in `src-tauri/src/commands/`. They internally call `executeCommand` with correct payload, reducing boilerplate.

| API | Equivalent Capability |
|-----|----------------------|
| `renameBlock(fileId, blockId, name)` | `core.rename` |
| `changeBlockType(fileId, blockId, type, ext)` | `core.change_type` |
| `updateBlockMetadata(fileId, blockId, meta)` | `core.update_metadata` |
| `createEditor(fileId, name, type, blockId)` | `editor.create` |
| `deleteEditor(fileId, editorId, blockId)` | `editor.delete` |

---

## Part 5: Payload Reference

### Core
| Capability | Required | Optional |
|------------|----------|----------|
| `core.create` | `name`, `block_type` | `source`, `metadata` |
| `core.link` / `core.unlink` | `relation`, `target_id` | |
| `core.rename` | `name` | |
| `core.grant` / `core.revoke` | `target_editor`, `capability` | `target_block` |
| `core.delete` / `core.read` | (none) | |

### Content
| Capability | Required |
|------------|----------|
| `markdown.write` / `code.write` | `content` |

### Directory
| Capability | Required | Optional |
|------------|----------|----------|
| `directory.create` | `path`, `type`, `source` | `content`, `block_type` |
| `directory.delete` | `path` | |
| `directory.rename` | `old_path`, `new_path` | |
| `directory.export` | `target_path` | `source_path` |
| `directory.import` | `source_path` | `target_path` |

### Editor
| Capability | Required | Optional |
|------------|----------|----------|
| `editor.create` | `name` | `editor_type`, `editor_id` |
| `editor.delete` | `editor_id` | |

### Terminal
| Capability | Required | Optional |
|------------|----------|----------|
| `terminal.init` | (none - handler only validates block type) | |
| `terminal.close` | (none) | |
| `terminal.execute` | `command` | `exit_code` |
| `terminal.save` | `saved_content`, `saved_at` | |

> **Note**: For PTY operations, use Tauri commands directly:
> `initPtySession(blockId, cols, rows, cwd)`, `writeToPty`, `resizePty`, `closePtySession`

---

## Part 6: API & Capability List

### Commands (`commands.*`)

> **Note**: Commands use camelCase in TypeScript (auto-converted from Rust snake_case by tauri-specta).
> Example: Rust `init_pty_session` → TypeScript `initPtySession`

| Category | Commands (TypeScript) |
|----------|----------|
| File | `createFile`, `openFile`, `saveFile`, `closeFile`, `listOpenFiles`, `getFileInfo`, `renameFile`, `duplicateFile` |
| Block | `executeCommand`, `getBlock`, `getAllBlocks`, `updateBlockMetadata`, `renameBlock`, `changeBlockType`, `checkPermission` |
| Editor | `createEditor`, `deleteEditor`, `listEditors`, `getEditor`, `setActiveEditor`, `getActiveEditor` |
| Other | `listGrants`, `getBlockGrants`, `getAllEvents`, `getStateAtEvent`, `checkoutWorkspace` |
| Terminal | `initPtySession`, `writeToPty`, `resizePty`, `closePtySession` |

### Capabilities (`executeCommand`)
| Category | Capabilities |
|----------|--------------|
| Core | `core.create`, `core.delete`, `core.link`, `core.unlink`, `core.read`, `core.rename`, `core.change_type`, `core.update_metadata`, `core.grant`, `core.revoke` |
| Content | `markdown.read`, `markdown.write`, `code.read`, `code.write` |
| Directory | `directory.create`, `directory.delete`, `directory.rename`, `directory.rename_with_type_change`, `directory.write`, `directory.export`, `directory.import` |
| Editor | `editor.create`, `editor.delete` |
| Terminal | `terminal.init`, `terminal.close`, `terminal.execute`, `terminal.save` |

---

## Part 7: Code Pattern

```typescript
import { commands, Command } from '@/bindings'

// Execute capability
const cmd: Command = {
  cmd_id: crypto.randomUUID(),
  editor_id: editorId,
  cap_id: 'markdown.write',
  block_id: blockId,
  payload: { content: '# Hello' },
  timestamp: new Date().toISOString()
}
const result = await commands.executeCommand(fileId, cmd)

// Check result
if (result.status === 'ok') {
  console.log(result.data)
} else {
  console.error(result.error)
}
```

---

## Part 8: Checklist

### Frontend
- [ ] Used `commands` from `@/bindings` (not `invoke()`)
- [ ] Used generated types from `@/bindings` (not manual interfaces)
- [ ] Did NOT edit `src/bindings.ts`

### Backend
- [ ] Defined Payload with `#[derive(Serialize, Deserialize, Type)]`
- [ ] Registered capability in `registry.rs` via `self.register(Arc::new(...))`
- [ ] Registered command in `lib.rs` (both debug + release handlers)
- [ ] Ran `pnpm tauri dev` to regenerate bindings
- [ ] Added tests (handler logic + authorization checks)

### Both
- [ ] `pnpm tauri dev` runs without errors
- [ ] `pnpm tsc --noEmit` passes (no TypeScript errors)
