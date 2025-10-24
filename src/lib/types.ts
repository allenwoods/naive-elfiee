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

export type Command =
  | { type: 'Create'; block_id: string; parent_id: string | null; content: BlockContent }
  | { type: 'Delete'; block_id: string }
  | { type: 'Link'; from_id: string; to_id: string }
  | { type: 'Unlink'; from_id: string; to_id: string }
  | { type: 'Write'; block_id: string; content: BlockContent }
  | { type: 'UpdateMetadata'; block_id: string; metadata: Record<string, string> };

export interface FileInfo {
  fileId: string;
  path: string;
}
