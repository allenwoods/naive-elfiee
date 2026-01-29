---
name: elfiee-mcp
description: "Guide for using Elfiee MCP tools to interact with .elf files. Use when Claude needs to read, write, or manage blocks inside .elf projects via MCP tools (elfiee_file_list, elfiee_block_*, elfiee_markdown_*, elfiee_code_*, elfiee_directory_*, elfiee_terminal_*, elfiee_grant/revoke, elfiee_editor_*, elfiee_exec). Triggers: working with .elf files, managing blocks, reading/writing markdown or code in blocks, directory operations inside .elf, terminal sessions, permission management."
---

# Elfiee MCP Tools

Elfiee exposes MCP tools (SSE on port 47200) for interacting with `.elf` files. Elfiee GUI **must be running** with files open.

**CRITICAL**: NEVER use filesystem commands (`cat`, `ls`, `rm`, etc.) on `.elf` contents. Always use MCP tools.

## Quick Start

1. Call `elfiee_file_list` to get open projects and their paths
2. Use the `project` path (e.g., `"./my.elf"`) in all subsequent calls
3. Call `elfiee_block_list` to discover blocks
4. Use type-specific tools to read/write content

## Common Parameter: `project`

Every tool (except `elfiee_file_list`) requires `project` -- the `.elf` file path as returned by `elfiee_file_list`.

## Block Types

`markdown` | `code` | `directory` | `terminal`

## Tool Reference

### File Discovery

| Tool | Purpose | Params |
|------|---------|--------|
| `elfiee_file_list` | List open .elf files | (none) |

### Block CRUD

| Tool | Purpose | Key Params |
|------|---------|------------|
| `elfiee_block_list` | List all blocks | `project` |
| `elfiee_block_get` | Get block details | `project`, `block_id` |
| `elfiee_block_create` | Create block | `project`, `name`, `block_type`, `parent_id?` |
| `elfiee_block_delete` | Delete block | `project`, `block_id` |
| `elfiee_block_rename` | Rename block | `project`, `block_id`, `name` |
| `elfiee_block_change_type` | Change type | `project`, `block_id`, `new_type` |
| `elfiee_block_update_metadata` | Update metadata | `project`, `block_id`, `metadata` (JSON object) |

### Block Relations

| Tool | Purpose | Key Params |
|------|---------|------------|
| `elfiee_block_link` | Link parent->child | `project`, `parent_id`, `child_id`, `relation` |
| `elfiee_block_unlink` | Remove relation | `project`, `parent_id`, `child_id`, `relation` |

Relation types: `contains`, `references`, or custom strings.

### Content Read/Write

| Tool | Purpose | Key Params |
|------|---------|------------|
| `elfiee_markdown_read` | Read markdown | `project`, `block_id` |
| `elfiee_markdown_write` | Write markdown | `project`, `block_id`, `content` |
| `elfiee_code_read` | Read code | `project`, `block_id` |
| `elfiee_code_write` | Write code | `project`, `block_id`, `content` |

### Directory Operations

| Tool | Purpose | Key Params |
|------|---------|------------|
| `elfiee_directory_create` | Create file/dir entry | `project`, `block_id`, `path`, `type` (`file`/`directory`), `source` (`outline`/`linked`), `content?`, `block_type?` |
| `elfiee_directory_delete` | Delete entry | `project`, `block_id`, `path` |
| `elfiee_directory_rename` | Move/rename entry | `project`, `block_id`, `old_path`, `new_path` |
| `elfiee_directory_write` | Batch update entries | `project`, `block_id`, `entries` (JSON), `source?` |
| `elfiee_directory_import` | Import from filesystem | `project`, `block_id`, `source_path`, `target_path?` |
| `elfiee_directory_export` | Export to filesystem | `project`, `block_id`, `target_path`, `source_path?` |

### Terminal Operations

| Tool | Purpose | Key Params |
|------|---------|------------|
| `elfiee_terminal_init` | Start terminal session | `project`, `block_id`, `shell?` |
| `elfiee_terminal_execute` | Run command | `project`, `block_id`, `command` |
| `elfiee_terminal_save` | Save session content | `project`, `block_id`, `content` |
| `elfiee_terminal_close` | Close session | `project`, `block_id` |

### Permission (CBAC)

| Tool | Purpose | Key Params |
|------|---------|------------|
| `elfiee_grant` | Grant capability | `project`, `block_id`, `editor_id`, `cap_id` |
| `elfiee_revoke` | Revoke capability | `project`, `block_id`, `editor_id`, `cap_id` |

Capability IDs: `core.create`, `core.link`, `core.unlink`, `core.delete`, `core.grant`, `core.revoke`, `markdown.write`, `markdown.read`, `code.write`, `code.read`, `directory.create`, `directory.delete`, `directory.rename`, `directory.write`, `terminal.init`, `terminal.execute`, `terminal.save`, `terminal.close`.

### Editor Management

| Tool | Purpose | Key Params |
|------|---------|------------|
| `elfiee_editor_create` | Create editor | `project`, `editor_id`, `name?` |
| `elfiee_editor_delete` | Delete editor | `project`, `editor_id` |

### Generic Execution

| Tool | Purpose | Key Params |
|------|---------|------------|
| `elfiee_exec` | Execute any capability | `project`, `capability`, `block_id?`, `payload?` |

Use `elfiee_exec` for capabilities not covered by dedicated tools.

## Workflow Examples

### Read all markdown blocks

```
1. elfiee_file_list -> get project path
2. elfiee_block_list(project) -> find blocks where block_type == "markdown"
3. elfiee_markdown_read(project, block_id) -> for each markdown block
```

### Create a code file in a directory block

```
1. elfiee_file_list -> get project path
2. elfiee_block_list(project) -> find directory block
3. elfiee_directory_create(project, block_id, path="src/main.rs",
     type="file", source="outline", content="fn main() {}",
     block_type="code")
```

### Execute a terminal command

```
1. elfiee_file_list -> get project path
2. elfiee_block_list(project) -> find terminal block
3. elfiee_terminal_init(project, block_id)
4. elfiee_terminal_execute(project, block_id, command="cargo build")
5. elfiee_terminal_close(project, block_id)
```

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `Project not open` | .elf file not loaded in GUI | Open file in Elfiee GUI first |
| `Block not found` | Invalid block_id | Use `elfiee_block_list` to get valid IDs |
| `No active editor` | No editor session for file | GUI must have an active editor session |
| `Engine not found` | Engine not started for file | Reopen file in GUI |
