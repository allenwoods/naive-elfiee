/**
 * Application Constants
 *
 * Defines available capabilities and other constant values used throughout the app.
 */

/**
 * Available capabilities in the system
 *
 * These are the capability IDs that can be granted/revoked between editors.
 */
export const AVAILABLE_CAPABILITIES = [
  // Core capabilities
  { id: 'core.create', label: 'Create Blocks', description: 'Create new blocks' },
  { id: 'core.link', label: 'Link Blocks', description: 'Create relations between blocks' },
  {
    id: 'core.unlink',
    label: 'Unlink Blocks',
    description: 'Remove relations between blocks',
  },
  { id: 'core.delete', label: 'Delete Blocks', description: 'Delete blocks' },
  { id: 'core.grant', label: 'Grant Permissions', description: 'Grant capabilities to editors' },
  {
    id: 'core.revoke',
    label: 'Revoke Permissions',
    description: 'Revoke capabilities from editors',
  },

  // Markdown capabilities
  { id: 'markdown.write', label: 'Write Markdown', description: 'Edit markdown content' },
  { id: 'markdown.read', label: 'Read Markdown', description: 'Read markdown content' },
] as const

/**
 * Get capability label by ID
 */
export function getCapabilityLabel(capId: string): string {
  const cap = AVAILABLE_CAPABILITIES.find((c) => c.id === capId)
  return cap ? cap.label : capId
}

/**
 * Get capability description by ID
 */
export function getCapabilityDescription(capId: string): string {
  const cap = AVAILABLE_CAPABILITIES.find((c) => c.id === capId)
  return cap ? cap.description : ''
}
