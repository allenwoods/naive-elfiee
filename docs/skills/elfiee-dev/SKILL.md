---
name: elfiee-system
description: How AI should interact with .elf files. MUST use elf APIs, NOT filesystem commands.
---

# Elfiee System Interface

**CRITICAL**: When working with `.elf` files, you MUST use Elfiee APIs. NEVER use filesystem commands.

---

## Forbidden Operations

### Read (use Read APIs instead)
| Bash | PowerShell | Git |
|------|------------|-----|
| `cat`, `head`, `tail`, `less`, `more` | `Get-Content`, `type` | `git show` |
| `ls`, `find`, `tree` | `Get-ChildItem`, `dir` | `git ls-files` |
| `grep`, `rg`, `awk` | `Select-String` | `git grep` |

### Create (use `core.create` capability instead)
| Bash | PowerShell |
|------|------------|
| `touch`, `mkdir` | `New-Item`, `md` |
| `echo "..." > file`, `cp` | `Set-Content`, `Out-File`, `Copy-Item` |

### Delete (use `core.delete` capability instead)
| Bash | PowerShell |
|------|------------|
| `rm`, `rmdir` | `Remove-Item`, `del`, `rd` |

### Modify (use Write APIs instead)
| Bash | PowerShell | Editor |
|------|------------|--------|
| `echo >> file`, `sed` | `Add-Content`, `Set-Content` | `vim`, `nano`, `code` |
| `mv`, `rename` | `Move-Item`, `Rename-Item` | |

### Git (NEVER use git on .elf internal files)
| Forbidden |
|-----------|
| `git add block-xxx/`, `git commit`, `git checkout` on .elf contents |
| Direct access to `_eventstore.db`, `_snapshot`, `_blocks_*` |

---

## Read APIs

| Task | API |
|------|-----|
| Get block | `commands.getBlock(fileId, blockId)` |
| List all blocks | `commands.getAllBlocks(fileId)` |
| Get active editor | `commands.getActiveEditor(fileId)` |
| List editors | `commands.listEditors(fileId)` |
| List permissions | `commands.listGrants(fileId)` |
| Check permission | `commands.checkPermission(fileId, editorId, blockId, capId)` |
| Get event history | `commands.getAllEvents(fileId)` |

---

## Write APIs

All writes use `commands.executeCommand(fileId, cmd)` with a capability:

| Task | Capability | Payload |
|------|------------|---------|
| Write markdown | `markdown.write` | `{ content }` |
| Write code | `code.write` | `{ content }` |
| Create block | `core.create` | `{ name, block_type }` |
| Delete block | `core.delete` | (none) |
| Link blocks | `core.link` | `{ relation, target_id }` |
| Unlink blocks | `core.unlink` | `{ relation, target_id }` |
| Rename block | `core.rename` | `{ name }` |

### Convenience APIs

| Task | API |
|------|-----|
| Rename block | `commands.renameBlock(fileId, blockId, name)` |
| Change block type | `commands.changeBlockType(fileId, blockId, type, ext)` |
| Create editor | `commands.createEditor(fileId, name, type, blockId)` |
| Delete editor | `commands.deleteEditor(fileId, editorId, blockId)` |

---

## File APIs

| Task | API |
|------|-----|
| Open file | `commands.openFile(path)` → returns fileId |
| Create file | `commands.createFile(path)` |
| Save file | `commands.saveFile(fileId)` |
| Close file | `commands.closeFile(fileId)` |
| List open files | `commands.listOpenFiles()` |

---

## Terminal APIs

| Task | API |
|------|-----|
| Init PTY | `commands.initPtySession(blockId, cols, rows, cwd)` |
| Write to PTY | `commands.writeToPty(blockId, data)` |
| Resize PTY | `commands.resizePty(blockId, cols, rows)` |
| Close PTY | `commands.closePtySession(blockId)` |
