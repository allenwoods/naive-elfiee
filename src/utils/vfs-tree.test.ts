import { describe, it, expect } from 'vitest'
import { buildTreeFromEntries, type DirectoryEntry } from './vfs-tree'
import type { Block } from '@/bindings'

describe('buildTreeFromEntries', () => {
  const mockBlocks: Block[] = [
    {
      block_id: 'b1',
      name: 'file1.md',
      block_type: 'markdown',
      contents: {},
      children: {},
      owner: 'user',
      metadata: {},
    },
    {
      block_id: 'b2',
      name: 'main.rs',
      block_type: 'code',
      contents: {},
      children: {},
      owner: 'user',
      metadata: {},
    },
  ]

  it('should build a flat tree for top-level entries', () => {
    const entries: Record<string, DirectoryEntry> = {
      'file1.md': {
        id: 'b1',
        type: 'file',
        source: 'outline',
        updated_at: 'now',
      },
      src: {
        id: 'dir1',
        type: 'directory',
        source: 'outline',
        updated_at: 'now',
      },
    }

    const tree = buildTreeFromEntries(entries, mockBlocks)

    expect(tree).toHaveLength(2)
    expect(tree[0].name).toBe('src') // Sorted: directory first
    expect(tree[0].type).toBe('directory')
    expect(tree[1].name).toBe('file1.md')
    expect(tree[1].type).toBe('file')
    expect(tree[1].blockType).toBe('markdown')
  })

  it('should build a nested tree structure', () => {
    const entries: Record<string, DirectoryEntry> = {
      src: {
        id: 'dir1',
        type: 'directory',
        source: 'linked',
        updated_at: 'now',
      },
      'src/main.rs': {
        id: 'b2',
        type: 'file',
        source: 'linked',
        updated_at: 'now',
      },
      'README.md': {
        id: 'b1',
        type: 'file',
        source: 'linked',
        updated_at: 'now',
      },
    }

    const tree = buildTreeFromEntries(entries, mockBlocks)

    expect(tree).toHaveLength(2) // src and README.md at root
    const srcNode = tree.find((n) => n.name === 'src')!
    expect(srcNode.children).toHaveLength(1)
    expect(srcNode.children[0].name).toBe('main.rs')
    expect(srcNode.children[0].path).toBe('src/main.rs')
    expect(srcNode.children[0].blockType).toBe('code')
  })

  it('should handle missing parent entries gracefully by placing orphans at root', () => {
    const entries: Record<string, DirectoryEntry> = {
      'a/b/c.md': {
        id: 'b1',
        type: 'file',
        source: 'outline',
        updated_at: 'now',
      },
    }

    const tree = buildTreeFromEntries(entries, mockBlocks)

    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('c.md')
    expect(tree[0].path).toBe('a/b/c.md')
  })

  it('should sort directories before files and then alphabetically', () => {
    const entries: Record<string, DirectoryEntry> = {
      'z.md': { id: 'b1', type: 'file', source: 'outline', updated_at: 'now' },
      'a.md': { id: 'b1', type: 'file', source: 'outline', updated_at: 'now' },
      docs: {
        id: 'dir1',
        type: 'directory',
        source: 'outline',
        updated_at: 'now',
      },
      assets: {
        id: 'dir2',
        type: 'directory',
        source: 'outline',
        updated_at: 'now',
      },
    }

    const tree = buildTreeFromEntries(entries, mockBlocks)

    expect(tree[0].name).toBe('assets')
    expect(tree[1].name).toBe('docs')
    expect(tree[2].name).toBe('a.md')
    expect(tree[3].name).toBe('z.md')
  })
})
