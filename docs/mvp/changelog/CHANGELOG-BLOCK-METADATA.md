# Block Metadata System Implementation

## Overview

This feature adds a flexible metadata system to Block entities, enabling automatic timestamp tracking, custom fields, and proper event-sourcing integration. The implementation follows the EAVT (Entity-Attribute-Value-Timestamp) model and maintains backward compatibility.

**Branch**: `feat/block-metadata-v2`
**PR**: #27
**Commits**: dd4879e → d2fa098 (5 commits)
**Status**: ✅ Merged to dev

## Key Features

- **Automatic Timestamps**: `created_at` and `updated_at` in ISO 8601 UTC format
- **Custom Fields**: Flexible JSON structure with `#[serde(flatten)]` support
- **Type Safety**: `BlockMetadata` struct with tauri-specta bindings
- **Event Sourcing**: Full integration with EAVT event store
- **Non-Breaking**: Metadata defaults to empty object `{}`

## New Files

### 1. `src-tauri/src/models/metadata.rs`
Block metadata structure with helper methods.

**Core Structure**:
```rust
pub struct BlockMetadata {
    pub description: Option<String>,
    pub created_at: Option<String>,   // ISO 8601 UTC
    pub updated_at: Option<String>,   // ISO 8601 UTC
    #[serde(flatten)]
    pub custom: HashMap<String, serde_json::Value>,
}
```

**Methods**:
- `new()` - Create with current timestamps
- `from_json(value)` - Parse from JSON Value
- `to_json()` - Convert to JSON Value
- `touch()` - Update `updated_at` to current time

**Test Coverage**: 7 tests covering serialization, timestamps, and custom fields

## Modified Files

### 1. `src-tauri/src/models/block.rs`
**Added**:
- `metadata: JsonValue` field to `Block` struct
- Default initialization to `serde_json::json!({})`
- Test: `test_block_with_metadata`, `test_new_block_has_empty_metadata`

**Before**:
```rust
pub struct Block {
    pub block_id: String,
    pub name: String,
    pub block_type: String,
    pub contents: JsonValue,
    pub children: HashMap<String, Vec<String>>,
    pub owner: String,
}
```

**After**:
```rust
pub struct Block {
    pub block_id: String,
    pub name: String,
    pub block_type: String,
    pub contents: JsonValue,
    pub children: HashMap<String, Vec<String>>,
    pub owner: String,
    pub metadata: JsonValue,  // NEW
}
```

### 2. `src-tauri/src/models/payloads.rs`
**Added**:
- `metadata: Option<JsonValue>` field to `CreateBlockPayload`

**Behavior**:
- If user provides metadata, it's merged with auto-generated timestamps
- If not provided, only timestamps are set

### 3. `src-tauri/src/capabilities/builtins/create.rs`
**Modified**: `handle_create()` function

**New Logic**:
1. Generate base metadata with timestamps using `BlockMetadata::new()`
2. Merge user-provided metadata from `CreateBlockPayload`
3. Include metadata in `core.create` event

**Tests Added**:
- `test_create_generates_metadata_with_timestamps`
- `test_create_merges_user_metadata`
- `test_create_without_metadata`

### 4. `src-tauri/src/extensions/markdown/markdown_write.rs`
**Modified**: `handle_markdown_write()` function

**New Logic**:
1. Clone existing block metadata
2. Update `updated_at` field to current timestamp
3. Preserve all other metadata fields (description, custom fields, created_at)
4. Handle corrupted metadata (non-object) by reinitializing with preserved `created_at`

**Tests Added**:
- `test_markdown_write_updates_timestamp`
- `test_markdown_write_preserves_other_metadata`
- `test_markdown_write_handles_missing_metadata`
- `test_markdown_write_handles_null_metadata_with_created_at`

### 5. `src-tauri/src/engine/state.rs`
**Modified**: `apply_event()` function

**New Logic**:
- Apply metadata from events during state projection
- Support `.create` events with initial metadata
- Support `.write` events with updated metadata

**Tests Added**:
- `test_apply_create_event_with_metadata`
- `test_apply_write_event_updates_metadata`
- `test_replay_maintains_metadata`

### 6. `src-tauri/src/engine/actor.rs`
**Modified**: `process_command()` function

**New Logic**:
- Inject `_block_dir` path before command execution
- Strip `_block_dir` from events before persistence

**Tests Added**:
- `test_create_block_with_metadata`
- `test_metadata_persists_after_replay`
- `test_write_updates_timestamp`

### 7. `src-tauri/src/lib.rs`
**Modified**: Type registration for tauri-specta

**Added**:
```rust
.typ::<models::BlockMetadata>()
```

Ensures TypeScript bindings are generated for frontend.

### 8. `src/bindings.ts` (Auto-generated)
**Added TypeScript Types**:
```typescript
export type BlockMetadata = {
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
} & Partial<{ [key in string]: JsonValue }>;

export type Block = {
  // ... existing fields
  metadata: JsonValue;
};

export type CreateBlockPayload = {
  name: string;
  block_type: string;
  metadata?: JsonValue | null;
};
```

## Follow-up Fixes

### Fix 1: Field Naming Consistency (commit 3507236)
**Issue**: `FileMetadata.last_modified` vs `BlockMetadata.updated_at` inconsistency

**Changes**:
- Renamed `FileMetadata.last_modified` → `updated_at`
- Updated `commands/file.rs` local variable naming
- Regenerated TypeScript bindings

### Fix 2: PR Review Feedback (commit 6f74d50)
**Issue**: Chinese comments in production code

**Changes**:
- Translated all doc comments in `models/metadata.rs` to English
- Preserved `created_at` when reinitializing corrupted metadata
- Added defensive test for null metadata handling

### Fix 3: Test Comment Translation (commit d2fa098)
**Changes**:
- Translated test comments in `create.rs`
- Translated test comments in `markdown_write.rs`
- Translated test comments in `metadata.rs`

## Architecture Design

### Event Sourcing Pattern: Snapshot vs Delta

**Current Implementation**: **Event as Snapshot**
- Events contain full metadata state
- State projector performs simple replacement
- Each event is self-contained

**Rationale**:
- Simpler projector logic (no merge complexity)
- Easier debugging (each event shows complete state)
- Consistent with current capability handler pattern
- No data loss risk with current handlers (all clone full metadata)

**Alternative** (not implemented): Event as Delta
- Would require merge logic in `state.rs`
- Smaller events but more complex projection
- Can be refactored later if needed

### Metadata Update Pattern

**Best Practice** (enforced by handler implementations):
```rust
// ✅ CORRECT - Clone then update
let mut new_metadata = block.metadata.clone();
if let Some(obj) = new_metadata.as_object_mut() {
    obj.insert("updated_at".to_string(), serde_json::json!(now_utc()));
}

// ❌ WRONG - Partial update loses fields
let new_metadata = serde_json::json!({ "updated_at": now_utc() });
```

## Testing Summary

**Total Tests Added**: 19 tests across 5 modules

| Module | Tests | Coverage |
|--------|-------|----------|
| `metadata.rs` | 7 | Serialization, timestamps, custom fields |
| `create.rs` | 3 | Metadata generation and merging |
| `markdown_write.rs` | 4 | Timestamp updates, field preservation |
| `state.rs` | 3 | Event projection with metadata |
| `actor.rs` | 2 | End-to-end persistence |

**Test Results**: ✅ 101 tests passing

## Migration Guide

### For Existing Blocks

**No migration needed** - Existing blocks without metadata will have `metadata: {}` by default.

### For New Capabilities

When implementing new capabilities that modify blocks:

1. **Clone existing metadata**:
   ```rust
   let mut new_metadata = block.metadata.clone();
   ```

2. **Update timestamp**:
   ```rust
   if let Some(obj) = new_metadata.as_object_mut() {
       obj.insert("updated_at".to_string(), serde_json::json!(now_utc()));
   }
   ```

3. **Include in event**:
   ```rust
   serde_json::json!({
       "contents": new_contents,
       "metadata": new_metadata
   })
   ```

### For Frontend

Use type-safe bindings:
```typescript
import { BlockMetadata, CreateBlockPayload } from './bindings';

// Creating a block with metadata
const payload: CreateBlockPayload = {
  name: "My Block",
  block_type: "markdown",
  metadata: {
    description: "Project requirements doc"
  }
};

// Accessing metadata
const created_at = block.metadata.created_at;
const description = block.metadata.description;
```

## Known Limitations

1. **BlockMetadata.touch() unused**: Method defined but not called by any capability
   - Can be used by future extensions
   - Consider adding usage examples in documentation

2. **No validation of custom fields**: Any JSON value can be added to `custom`
   - Future enhancement: JSON schema validation
   - Current design prioritizes flexibility

3. **Metadata size limits**: No hard limits on metadata size
   - Event store can handle large JSON values
   - Consider adding limits in future if needed

## Reviewer Feedback Addressed

### @jjkysy
- ✅ Metadata replacement pattern clarified (Snapshot vs Delta)
- ✅ Chinese comments translated to English
- ✅ `created_at` preservation in edge cases

### @claude-bot
- ✅ Chinese comments in tests translated
- ✅ Defensive handling for corrupted metadata
- ✅ Test coverage for partial metadata updates

## Related Documentation

- `docs/concepts/ARCHITECTURE_OVERVIEW.md` - EAVT model explanation
- `docs/guides/EXTENSION_DEVELOPMENT.md` - Metadata handling patterns (to be added)
- `src-tauri/src/utils/time.rs` - Timestamp utility functions

## Metrics

- **Files Modified**: 9 files (+ 1 new)
- **Lines Added**: ~800 lines (code + tests)
- **Test Coverage**: 19 new tests
- **Breaking Changes**: None
- **Performance Impact**: Negligible (simple JSON clone)

---

**Last Updated**: 2025-12-19
**Author**: Sy Yao
**Reviewers**: @jjkysy, @claude-bot
