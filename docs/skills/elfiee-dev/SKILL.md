---
name: elfiee-system
description: "[System-level] How AI agents interact with .elf files via HTTP API."
---

# Elfiee System Interface

**CRITICAL**: When working with `.elf` files, MUST use Elfiee HTTP API. NEVER use filesystem commands.

---

## Prerequisites

Elfiee GUI must be running. IPC Server: `http://127.0.0.1:47100`

```bash
curl -s http://127.0.0.1:47100/health
```

---

## API Routes

```
GET  /health                - Health check
GET  /api/file/list         - List open files
POST /api/block/list        - List blocks (body: {project})
POST /api/block/get         - Get block (body: {project, block})
POST /api/capability/exec   - Execute capability
```

---

## Forbidden Operations

| Instead of | Use |
|------------|-----|
| `cat`, `ls`, `find` on .elf | `/api/block/list`, `/api/block/get` |
| `echo >`, `touch`, `mkdir` | `directory.create` capability |
| `rm`, `rmdir` | `directory.delete` capability |
| `git add/commit` on .elf internals | Never - .elf manages its own history |

---

## Capability Exec Format

```json
{
  "capability": "<cap_id>",
  "project": "./my.elf",
  "block": "<block_id>",
  "payload": {}
}
```

---

## Capabilities

| Capability | Payload |
|------------|---------|
| `directory.write` | `{ path, content }` |
| `directory.create` | `{ path, type, source, content?, block_type? }` |
| `directory.delete` | `{ path }` |
| `directory.rename` | `{ old_path, new_path }` |
| `markdown.write` | `{ content }` |
| `code.write` | `{ content }` |

---

## Block Types

`directory` | `markdown` | `code` | `terminal`
