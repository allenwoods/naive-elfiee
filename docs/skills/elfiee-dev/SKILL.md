---
name: elfiee-system
description: "[System-level] How AI agents interact with .elf files via MCP."
---

# Elfiee System Interface

**CRITICAL**: When working with `.elf` files, use Elfiee MCP Server. NEVER use filesystem commands on .elf contents.

---

## Prerequisites

1. Elfiee GUI must be running (MCP Server starts automatically on port 47200)
2. MCP configured in `.mcp.json` (project root):

```json
{
  "mcpServers": {
    "elfiee": {
      "type": "sse",
      "url": "http://127.0.0.1:47200/sse"
    }
  }
}
```

---

## Forbidden Operations

| Instead of | Use |
|------------|-----|
| `cat`, `ls`, `find` on .elf | `elfiee_block_list`, `elfiee_block_get` |
| `echo >`, `touch`, `mkdir` | `elfiee_directory_create` |
| `rm`, `rmdir` | `elfiee_directory_delete` |
| `git add/commit` on .elf internals | Never - .elf manages its own history |

---

## Available MCP Tools

Tools are auto-discovered by Claude Code via MCP protocol. Key tools:

| Tool | Description |
|------|-------------|
| `elfiee_file_list` | List open .elf files |
| `elfiee_block_list` | List blocks in a project |
| `elfiee_block_get` | Get block details |
| `elfiee_block_create` | Create block (markdown, code, directory, terminal) |
| `elfiee_block_delete` | Delete block |
| `elfiee_block_rename` | Rename block |
| `elfiee_block_link` | Add block relation |
| `elfiee_block_unlink` | Remove block relation |
| `elfiee_markdown_read/write` | Read/write markdown content |
| `elfiee_code_read/write` | Read/write code content |
| `elfiee_directory_create/delete/rename/write/import/export` | Directory operations |
| `elfiee_terminal_init/execute/save/close` | Terminal operations |
| `elfiee_grant/revoke` | Permission management |
| `elfiee_editor_create/delete` | Editor management |
| `elfiee_exec` | Execute any capability |

## MCP Resources

Read-only data accessible via `resources/read`:

| URI Pattern | Description |
|-------------|-------------|
| `elfiee://files` | List of open files |
| `elfiee://{project}/blocks` | All blocks in a project |
| `elfiee://{project}/block/{block_id}` | Single block content |
| `elfiee://{project}/grants` | Permission grants |
| `elfiee://{project}/events` | Event sourcing log |

---

## Block Types

`directory` | `markdown` | `code` | `terminal`
