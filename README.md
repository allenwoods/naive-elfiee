# Elfiee: Core Engineering Design Specification

## Overview

Elfiee (Event-sourcing Literate programming Format Integrated Editing Environment) is a block-based editor for the `.elf` file format. This document outlines the core engineering design for its initial development phase.

The system is built on three primary principles:

1.  **Block-based Editing:** The file is a composite of versioned, typed blocks (e.g., markdown, code, diagrams).
2.  **Event Sourcing:** All changes are captured as an immutable log of events, providing a complete history and enabling robust versioning and collaboration.
3.  **Capability-based Architecture:** Functionality is not monolithic but defined by "Capabilities" (e.g., `markdown.write`, `code.execute`) that are dynamically associated with block types and granted to editors.

This document details the data models, event structure, file format, extension interface, processing engine, and application interface.

## Part 1: Elf Core Data Models

The core model defines the abstract entities of the system. We recommend using strongly-typed definitions (e.g., TypeScript/Rust structs) for implementation.

### Primary Entities

Block

A Block is the fundamental unit of content. It is a container for data and holds relations to other blocks.

```
interface Block {
  block_id: string;   // UUID. Primary Key.
  name: string;       // User-facing name (e.g., "README.md", "User Service Logic")
  block_type: string; // Type identifier (e.g., "core/markdown", "custom/python-script")
  contents: object;   // JSON object. Holds metadata and lightweight content.
                      // Heavyweight content is stored in the file system (see Part 3).
  children: Record<string, string[]>; // Map<relation_type, block_id[]>
                                      // e.g., { "embeds": ["uuid-img-1"], "links": ["uuid-doc-2"] }
  owner: string;      // editor_id of the creator.
}
```

Editor

An Editor represents a user or agent interacting with the file.

```
interface Editor {
  editor_id: string; // UUID. Primary Key.
  name: string;      // User-facing name (e.g., "Alice", "Bob")
}
```

Capability

A Capability defines an action that can be performed. It decouples logic from the core engine.

```
interface Capability {
  cap_id: string;     // UUID or namespaced string (e.g., "markdown.write"). Primary Key.
  name: string;       // User-facing name (e.g., "Write Markdown")
  target: string;     // The block_type this capability applies to.
  
  /**
   * Checks if an editor is authorized to use this capability on a specific block.
   * @param editor_id - The ID of the editor attempting the action.
   * @param block - The target block.
   * @param db - Read-only access to the authorization table.
   * @returns boolean - True if authorized.
   */
  certificator: (editor_id: string, block: Block, db: AuthDatabase) => boolean;

  /**
   * Executes the command's logic.
   * @param command - The command containing the action payload.
   * @param state - Read/write access to the current system state (e.g., file system, state projection).
   * @returns Event[] - A list of generated events.
   * @throws Error - If execution fails.
   */
  handler: (command: Command, state: SystemState) => Event[];
}
```

### Access Control Model

Authorization is managed via a Capability-based Access Control (CBAC) model, implemented as a single "grants" table.

CapabilitiesGrant Table

This table is checked by the capability.certificator function.

| **Column**  | **Type** | **Description**                                         |
| ----------- | -------- | ------------------------------------------------------- |
| `editor_id` | `string` | (FK to Editor) The editor being granted permission.     |
| `cap_id`    | `string` | (FK to Capability) The capability being granted.        |
| `block_id`  | `string` | (FK to Block) The specific block this grant applies to. |

### Transactional Models

These models represent the flow of data through the system.

Command

A Command is an intent from an editor to perform an action. It is the input to the system.

```
interface Command {
  cmd_id: string;      // UUID for idempotency.
  editor_id: string;   // (FK to Editor) The author of the command.
  cap_id: string;      // (FK to Capability) The action being attempted.
  block_id: string;    // (FK to Block) The target of the action.
  payload: object;     // JSON object. The data needed by the handler 
                       // (e.g., { "body": "# New Markdown" }).
  timestamp: Date;     // Client-side timestamp of intent.
}
```

Event

An Event is an immutable fact representing a change that has occurred. It is the output of the capability.handler and the fundamental unit of storage.

```
interface Event {
  event_id: string;  // UUID. Primary Key.
  entity: string;    // The ID of the entity that changed (e.g., block_id, editor_id).
  attribute: string; // A descriptor of the change, typically: "{editor_id}/{cap_id}".
  value: object;     // JSON object. The data payload of the change.
  timestamp: Record<string, number>; // Vector clock: Map<editor_id, transaction_count>
                                     // for conflict resolution.
}
```

## Part 2: Elf Event Structure (EAVT)

All events are logged in the `_eventstore.db` using the EAVT (Entity-Attribute-Value-Timestamp) schema defined in the `Event` model. This structure allows for flexible and queryable history.

There are two primary categories of events:

### Block Events (Content & Structure)

These events represent changes to blocks.

| **Entity** | **Attribute**          | **Value (Payload)**            | **Timestamp**        | **Example**                                                  |
| ---------- | ---------------------- | ------------------------------ | -------------------- | ------------------------------------------------------------ |
| `block_id` | `{editor_id}/{cap_id}` | `object` (Delta or full state) | `{editor_id: count}` | **markdown.create**: `{ event_id: "e-1", entity: "b-aaa", attribute: "alice/md.create", value: { name: "New Note", type: "markdown", content: { body: "" }, ... }, timestamp: {"alice": 0} }` |
| `block_id` | `{editor_id}/{cap_id}` | `object` (Delta)               | `{editor_id: count}` | **markdown.write**: `{ event_id: "e-2", entity: "b-aaa", attribute: "alice/md.write", value: { content: { body: "# H1" } }, timestamp: {"alice": 1} }` |
| `block_id` | `{editor_id}/{cap_id}` | `object` (Delta)               | `{editor_id: count}` | **core.link**: `{ event_id: "e-3", entity: "b-aaa", attribute: "alice/core.link", value: { children: { "links": ["b-bbb"] } }, timestamp: {"alice": 2} }` |

-   **`create` events** typically contain the full initial state of the block in the `value` payload.
-   **`update` events** (like `write`) should contain a delta (just the changed fields) to save space. The state projector is responsible for merging these deltas.

### Editor Events (Permissions)

These events represent changes to the access control system.

| **Entity**  | **Attribute**       | **Value (Payload)**             | **Timestamp**        | **Example**                                                  |
| ----------- | ------------------- | ------------------------------- | -------------------- | ------------------------------------------------------------ |
| `editor_id` | `"grant"/{cap_id}`  | `string` (The target editor_id) | `{editor_id: count}` | **grant/markdown.write**: `{ event_id: "e-4", entity: "alice-id", attribute: "grant/md.write", value: "bob-id", timestamp: {"alice": 3} }` |
| `editor_id` | `"revoke"/{cap_id}` | `string` (The target editor_id) | `{editor_id: count}` | **revoke/markdown.write**: `{ event_id: "e-5", entity: "alice-id", attribute: "revoke/md.write", value: "bob-id", timestamp: {"alice": 4} }` |

## Part 3: Elf File Format (`.elf`)

The `.elf` file is a standard Zip archive. This format allows for bundling the event log, cached views, and heavyweight assets (like code, images) into a single, portable file.

When unzipped, the file structure is:

```
example.elf/
|
|-- _eventstore.db        # (Required) The canonical event log (e.g., SQLite file).
|-- _snapshot             # (Cache) Rendered markdown file of all blocks for fast read-only preview.
|-- _blocks_hash          # (Cache) JSON file: Map<block_id, hash(block_state)>
|-- _blocks_relation      # (Cache) JSON file: Cached graph structure for navigation.
|
|-- block-{uuid-1}/       # Directory for block-specific heavyweight assets.
|   |-- body.md
|   |-- diagram.excalidraw
|
|-- block-{uuid-2}/
|   |-- src/
|   |   |-- main.py
|   |-- .git/
|   |-- pyproject.toml
```

### File Content Descriptions

-   **`_eventstore.db`**: The single source of truth. This is an append-only log of all `Event` objects (see Part 2). An embedded SQLite database is recommended for its atomicity and query capabilities.
-   **`_snapshot`**: A cached, human-readable file (e.g., Markdown) generated by iterating through all blocks and calling their "abstract" (render) method (see Part 4).
-   **`_blocks_hash`**: A key-value store (e.g., JSON file) mapping `block_id` to a hash of its last projected state. This is used to quickly determine if a block's view in the `_snapshot` is stale and needs regeneration.
-   **`_blocks_relation`**: A cached representation of the `Block.children` graph for optimizing navigation and graph-based queries.
-   **`block-{uuid}/`**: Asset directories. The `Block.contents` JSON (Part 1) should store metadata, while any large, binary, or file-based content (e.g., code repos, images, markdown bodies) is stored here. The `Capability.handler` is responsible for managing files in this directory.

## Part 4: Elf Extension Interface

The core system is minimal. All concrete functionality is added via extensions, which are dynamically registered with the engine. An extension defines a new `block_type`.

An "Extension" package must provide:

1.  **Payload Schema**: A JSON Schema definition for the `Block.contents` object for this `block_type`. This is used for validation.
2.  **Relation Types**: A list of `relation_type` strings (e.g., "imports", "annotates") that this block can add to its `Block.children` map.
3.  **Abstract Method (Snapshot Renderer)**: A function `(block: Block) => string` that returns a string (e.g., markdown) representation of the block for inclusion in the `_snapshot` file.
4.  **Capability Handlers**: A map of `cap_id` to their corresponding `handler` and `certificator` functions (see Part 1). These handlers contain the actual business logic (e.g., what to do on `markdown.write` or `python.execute`).

Extensions inherit core capabilities (like `core.link`, `core.delete`, `core.grant`) automatically.



## Part 5: Elfile Engine

The Elfile Engine is the central command processor that maintains the system state for an open `.elf` file. For **multi-file** support, the system will instantiate a separate engine for each open file session, with each engine instance following an **Actor Model** paradigm. An application, called Elfin (ELF integrated editing environment) will manage all Elfile Engine.

In this model, each `Elfile Engine` instance is an "Actor" responsible *only* for its own file's state. It receives `Command` messages (which are sent from the Elfiee) from various editors (other actors) into a dedicated mailbox. This design ensures that all operations for a single file are processed serially and encapsulated within the actor, eliminating concurrent access to the file's state.

This engine Actor is designed to support **multi-user** concurrency by acting as the authoritative source for processing commands and resolving conflicts for its specific file. Its core responsibility is to serialize incoming command messages from multiple editors into a single, consistent, immutable log of events.

### Command Processing Workflow

1.  **Receive Command**: The Engine (Actor) receives a `Command` message from a specific `editor_id` in its mailbox.
2.  **Retrieve Components**: It loads the relevant `Capability` (from the extension registry) and the target `Block` and `Editor` from its *internal* state projection.
3.  **Authorize**: It calls `Capability.certificator(cmd.editor_id, block, db)`.
    -   **On FAIL**: Reject the command. Emit a "command_rejected" notification.
4.  **Execute**: It calls `Capability.handler(command, state)`.
    -   **On FAIL**: Reject the command. Roll back any state/file system changes. Emit a "command_failed" notification.
5.  **Receive Events**: The `handler` returns a list of one or more `Event` objects. These events are provisionally timestamped with the editor's new transaction count (e.g., `{"alice": 5}`).
6.  **Commit**: The Engine attempts an atomic append of the new `Event`s to the `_eventstore.db`.
    -   **Conflict Detection**: Before committing, the engine checks the vector clock of the command's base state (which must be tracked per editor session) against the latest events in the store.
    -   **On Conflict**: If another editor's events have been committed in the meantime (detected via the vector clock), the engine must: a.  Reject the command (optimistic concurrency failure) and notify the client, forcing them to re-base and retry. b.  (Advanced) Attempt to automatically merge the changes if the `handler` supports it, then re-run the handler. For this initial design, we will use (a) rejection.
    -   **On Success**: The events are committed. This is the commit point.
7.  **Project**: The Engine applies the newly committed events to its *master* in-memory state projection (e.g., updates the `Block` object).
8.  **Cache & Notify**: The Engine (asynchronously) updates the `_blocks_hash` and marks the `_snapshot` as stale. It then emits **"state_changed" events** to *all* connected clients (all users editing this file). This `"state_changed"` event contains the new, authoritative state projection, which the client UIs listen for to update their views. This ensures all participants are synchronized with the committed state.

Here is the English version of that section.

## Part 6: Elfiee App Interface

This section argues why the Elfiee architecture *requires* a Graphical User Interface (GUI). The system's design goals (blocks, rich content, graph relationships) make a Text-based User Interface (TUI) directly generate from Elfile core insufficient to meet the minimum viable product's interactive requirements.

Compared to a TUI, a GUI provides the following indispensable advantages:

1.  **WYSIWYG for Rich Content**
    The core of Elfiee is the `block_type`. A TUI can only display the *source code* of content (e.g., Markdown markup, a diagram's JSON). A GUI can **embed and render** rich, interactive content—such as diagrams, code editors, or formatted text—directly within the `BlockComponent`, enabling true "What You See Is What You Get" editing.

2.  **Spatial Layout and Direct Manipulation**
    "Block-based Editing" is a spatial metaphor. A GUI allows users to intuitively reorder, nest, or organize blocks using the core interaction of **Drag-and-Drop**. A TUI is inherently linear and cannot provide this fluid, non-linear experience of direct manipulation.

3.  **Visualization of Non-Linear Structure**
    The `Block.children` relationships and the `_blocks_relation` cache define a graph. At best, a TUI can display these relationships as a list of IDs. A GUI can render the entire file structure as an **interactive knowledge graph**, allowing users to visually explore and navigate the connections between blocks.

4.  **Intuitive Configuration of Complexity**
    The Capability-Based Access Control (CBAC) model is extremely difficult to manage in a TUI, requiring users to memorize and type complex commands. A GUI provides **visual configuration panels** (like a permission modal), enabling users to manage `Capability` grants and revocations with simple checkboxes and dropdowns, drastically reducing cognitive load.

5.  **Rich Collaboration and State Feedback**
    The system's multi-user engine (Part 5) relies on real-time state synchronization. A GUI can easily **overlay rich collaborative information** (like other users' cursors, avatars, and selection highlights) onto the content, providing an intuitive sense of "Presence" that is difficult to achieve in a TUI.

### Interface Communication Logic

Therefore, the Elfiee App Interface is designed as a **decoupled GUI architecture**:

* **UI (Frontend):** Acts as the sender of *intent* and the display for *state*. It translates all interactions (like dragging or clicking a button) into a `Command` (Part 1) and sends it to the backend.
* **Engine (Backend):** Acts as the *logic* processor and arbiter of *fact*. It processes the `Command`, commits an `Event` (Part 2), and broadcasts the authoritative *state projection* back to the UI.

The UI never modifies its local state directly. It is only responsible for rendering the latest state projection pushed to it by the Engine.