# Code Extension Development Guide

This extension provides capabilities for managing code blocks in the Elfiee system.

---

## Overview

- **code.read**: A permission marker capability. The actual content is read via the query layer (`get_block`). This capability is used to authorize access.
- **code.write**: capability to update the content of a code block.

## Capabilities

### Code Read (`code.read`)
- **Target**: `code` blocks
- **Role**: Authorization gate.
- **Payload**: None (empty struct).
- **Behavior**: Returns `Ok(vec![])` if authorized. Actual data retrieval is handled by `get_block`.

### Code Write (`code.write`)
- **Target**: `code` blocks
- **Role**: Update block content.
- **Payload**: `CodeWritePayload` containing the new `content`.
- **Behavior**: Generates a `code.write` event that updates the block's `contents.text` field.

## Testing

Run tests with:
```bash
cargo test extensions::code
```