/**
 * Core domain types matching Rust backend models
 */

export interface Block {
  id: string;
  parent_id: string | null;
  linked_to: string[];
  content: BlockContent;
  metadata: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface BlockContent {
  type: 'text' | 'link';
  data: string;
}

export interface Event {
  id: string;
  block_id: string;
  event_type: EventType;
  data: string;
  timestamp: string;
}

export type EventType =
  | 'Created'
  | 'Deleted'
  | 'Linked'
  | 'Unlinked'
  | 'ContentWritten'
  | 'MetadataUpdated';

/**
 * Command structure matching Rust backend
 */
export interface Command {
  cmd_id: string;
  editor_id: string;
  cap_id: string;
  block_id: string;
  payload: unknown;
  timestamp: string;
}

/**
 * Helper types for creating commands
 */
export type CreateBlockPayload = {
  parent_id: string | null;
  content: BlockContent;
};

export type WriteBlockPayload = {
  content: BlockContent;
};

export type LinkBlockPayload = {
  to_id: string;
};

export type UpdateMetadataPayload = {
  metadata: Record<string, string>;
};

export interface FileInfo {
  fileId: string;
  path: string;
}
