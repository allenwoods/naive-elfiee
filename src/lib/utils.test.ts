import { describe, expect, test } from 'vitest'
import { cn } from './utils'

describe('utils', () => {
  describe('cn', () => {
    test('should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    test('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
    })

    test('should handle undefined and null', () => {
      expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
    })

    test('should merge tailwind classes correctly', () => {
      expect(cn('text-red-500', 'text-blue-500')).toContain('text-blue-500')
      expect(cn('text-red-500', 'text-blue-500')).not.toContain('text-red-500')
    })
  })
})
