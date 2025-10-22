/**
 * Core data models matching Rust backend structures
 */

export interface Block {
  block_id: string;
  name: string;
  block_type: string;
  contents: Record<string, any>;
  children: Record<string, string[]>;
  owner: string;
}

export interface Editor {
  editor_id: string;
  name: string;
}

export interface Capability {
  cap_id: string;
  name: string;
  target: string; // block_type this capability applies to
}

export interface Command {
  cmd_id: string;
  editor_id: string;
  cap_id: string;
  block_id: string;
  payload: Record<string, any>;
  timestamp: string; // ISO 8601 datetime
}

export interface Event {
  event_id: string;
  entity: string;
  attribute: string;
  value: any;
  timestamp: Record<string, number>; // Vector clock: editor_id -> count
}
