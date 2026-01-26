---
name: elfiee-system
description: How AI should interact with .elf files. MUST use Elfiee HTTP API, NOT filesystem commands.
---

# Elfiee System Interface

**CRITICAL**: When working with `.elf` files, you MUST use Elfiee HTTP API. NEVER use filesystem commands.

---

## Prerequisites

Elfiee GUI must be running. The IPC Server listens on `http://127.0.0.1:47100`.

Check if Elfiee is running:
```bash
curl -s http://127.0.0.1:47100/health
# Expected: {"status":"ok","service":"elfiee-ipc","version":"0.1.0"}
```

---

## Forbidden Operations

### Read (use HTTP API instead)
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

### Modify (use HTTP API instead)
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

## HTTP API Usage

All operations use POST requests to `http://127.0.0.1:47100/api`.

### Request Format

```bash
curl -X POST http://127.0.0.1:47100/api \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: <your-session-id>" \
  -d '{"capability":"<capability>","project":"<path>","block":"<block_id>","payload":{...}}'
```

### Session ID

Set a unique session ID to identify your agent:
```bash
export ELFIEE_SESSION="claude-$(date +%s)"
```

---

## File Operations

### List Open Files
```bash
curl -s http://127.0.0.1:47100/api \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $ELFIEE_SESSION" \
  -d '{"capability":"file.list"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "files": [
      {"file_id": "file-abc123", "path": "/path/to/project.elf"}
    ],
    "count": 1
  }
}
```

### Open File
```bash
curl -s http://127.0.0.1:47100/api \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $ELFIEE_SESSION" \
  -d '{"capability":"file.open","project":"./my.elf"}'
```

### Save File
```bash
curl -s http://127.0.0.1:47100/api \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $ELFIEE_SESSION" \
  -d '{"capability":"file.save","project":"./my.elf"}'
```

---

## Block Operations

### List All Blocks
```bash
curl -s http://127.0.0.1:47100/api \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $ELFIEE_SESSION" \
  -d '{"capability":"block.list","project":"./my.elf"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "blocks": [
      {
        "block_id": "abc123",
        "name": "root",
        "block_type": "directory",
        "owner": "system",
        "children_count": 3
      }
    ],
    "count": 1
  }
}
```

### Get Block Details
```bash
curl -s http://127.0.0.1:47100/api \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $ELFIEE_SESSION" \
  -d '{"capability":"block.get","project":"./my.elf","block":"abc123"}'
```

---

## Write Operations

All write operations use capabilities through the same API endpoint.

### Create Block
```bash
curl -s http://127.0.0.1:47100/api \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $ELFIEE_SESSION" \
  -d '{
    "capability": "core.create",
    "project": "./my.elf",
    "payload": {
      "name": "notes",
      "block_type": "markdown"
    }
  }'
```

### Write Markdown
```bash
curl -s http://127.0.0.1:47100/api \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $ELFIEE_SESSION" \
  -d '{
    "capability": "markdown.write",
    "project": "./my.elf",
    "block": "abc123",
    "payload": {
      "content": "# Hello World\n\nThis is my document."
    }
  }'
```

### Write Code
```bash
curl -s http://127.0.0.1:47100/api \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $ELFIEE_SESSION" \
  -d '{
    "capability": "code.write",
    "project": "./my.elf",
    "block": "abc123",
    "payload": {
      "content": "console.log(\"Hello\");"
    }
  }'
```

### Link Blocks
```bash
curl -s http://127.0.0.1:47100/api \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $ELFIEE_SESSION" \
  -d '{
    "capability": "core.link",
    "project": "./my.elf",
    "block": "parent-id",
    "payload": {
      "child_id": "child-id",
      "relation": "contains"
    }
  }'
```

---

## Capability Reference

| Capability | Description | Payload |
|------------|-------------|---------|
| `core.create` | Create a new block | `{ name, block_type }` |
| `core.link` | Link two blocks | `{ child_id, relation }` |
| `core.unlink` | Remove link between blocks | `{ child_id, relation }` |
| `core.rename` | Rename a block | `{ name }` |
| `markdown.write` | Write markdown content | `{ content }` |
| `markdown.read` | Read markdown content | - |
| `code.write` | Write code content | `{ content }` |
| `code.read` | Read code content | - |

---

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_OPEN",
    "message": "Project ./my.elf is not open"
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `PROJECT_NOT_OPEN` | The project file is not open in Elfiee |
| `BLOCK_NOT_FOUND` | The specified block does not exist |
| `INVALID_CAPABILITY` | Unknown capability ID |
| `UNAUTHORIZED` | No permission to perform this action |
| `INVALID_PAYLOAD` | Payload format is incorrect |
| `MISSING_PARAMETER` | Required parameter is missing |
| `NO_ACTIVE_EDITOR` | No active editor set for the file |

---

## Best Practices

1. **Always check if Elfiee is running** before making API calls
2. **Use a consistent Session ID** to track your agent's activities
3. **List open files first** to get the project path
4. **Handle errors gracefully** - check `success` field in response
5. **Use JSON output format** for reliable parsing
