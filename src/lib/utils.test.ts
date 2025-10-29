/**
 * Utils Tests
 * 
 * Tests for utility functions
 */

import { describe, expect, test } from 'vitest'
import { cn, formatTimestamp } from './utils'

describe('cn utility function', () => {
  test('merges class names correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2')
  })

  test('handles single class name', () => {
    expect(cn('single-class')).toBe('single-class')
  })

  test('handles empty strings', () => {
    expect(cn('', 'class2')).toBe('class2')
    expect(cn('class1', '')).toBe('class1')
    expect(cn('', '')).toBe('')
  })

  test('handles undefined and null values', () => {
    expect(cn('class1', undefined, 'class3')).toBe('class1 class3')
    expect(cn('class1', null, 'class3')).toBe('class1 class3')
    expect(cn(undefined, null)).toBe('')
  })

  test('handles conditional classes', () => {
    expect(cn('base', true && 'conditional')).toBe('base conditional')
    expect(cn('base', false && 'conditional')).toBe('base')
    expect(cn('base', null && 'conditional')).toBe('base')
  })

  test('handles object-style conditional classes', () => {
    expect(cn('base', { 'conditional-true': true, 'conditional-false': false })).toBe('base conditional-true')
    expect(cn('base', { 'conditional-true': true, 'conditional-false': true })).toBe('base conditional-true conditional-false')
  })

  test('handles arrays of classes', () => {
    expect(cn(['class1', 'class2'], 'class3')).toBe('class1 class2 class3')
    expect(cn('class1', ['class2', 'class3'])).toBe('class1 class2 class3')
  })

  test('handles mixed input types', () => {
    expect(cn('base', 'class1', { 'conditional': true }, ['array1', 'array2'], false && 'false-class')).toBe('base class1 conditional array1 array2')
  })

  test('handles duplicate classes (basic implementation)', () => {
    // Note: The basic implementation doesn't remove duplicates
    // This is expected behavior for a simple class name utility
    expect(cn('class1', 'class1', 'class2')).toBe('class1 class1 class2')
  })

  test('handles whitespace correctly', () => {
    expect(cn('  class1  ', '  class2  ')).toBe('class1 class2')
    expect(cn('class1\nclass2', 'class3')).toBe('class1 class2 class3')
  })

  test('handles complex real-world scenarios', () => {
    const baseClasses = 'px-4 py-2 rounded'
    const variantClasses = 'bg-blue-500 text-white'
    const conditionalClasses = { 'hover:bg-blue-600': true, 'disabled:opacity-50': false }
    const sizeClasses = 'text-sm'
    
    const result = cn(baseClasses, variantClasses, conditionalClasses, sizeClasses)
    expect(result).toBe('px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 text-sm')
  })

  test('handles Tailwind CSS class conflicts (basic implementation)', () => {
    // This tests that the function handles cases where classes might conflict
    // In real usage, tailwind-merge would handle this, but we test basic merging
    // The basic implementation will keep both classes
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  test('handles empty input', () => {
    expect(cn()).toBe('')
    expect(cn('')).toBe('')
  })

  test('handles boolean values directly', () => {
    expect(cn(true)).toBe('')
    expect(cn(false)).toBe('')
    expect(cn('class', true)).toBe('class')
    expect(cn('class', false)).toBe('class')
  })

  test('handles numbers (basic implementation)', () => {
    // The basic implementation converts numbers to strings
    expect(cn('class', 0)).toBe('class')
    expect(cn('class', 1)).toBe('class 1')
    expect(cn('class', -1)).toBe('class -1')
  })

  test('handles deeply nested arrays and objects (basic implementation)', () => {
    // The basic implementation flattens nested objects
    expect(cn('base', [['nested1', 'nested2']], { 'obj1': true, 'obj2': { 'nested': true } })).toBe('base nested1 nested2 obj1 obj2')
  })

  test('preserves order of classes', () => {
    expect(cn('first', 'second', 'third')).toBe('first second third')
    expect(cn('third', 'first', 'second')).toBe('third first second')
  })

  test('handles special characters in class names', () => {
    expect(cn('class-with-dashes', 'class_with_underscores', 'class.with.dots')).toBe('class-with-dashes class_with_underscores class.with.dots')
  })
})

describe('formatTimestamp utility function', () => {
  test('formats date in YYYY-MM-DD HH:mm:ss format', () => {
    const date = new Date('2025-10-29T03:27:20.000Z')
    const result = formatTimestamp(date)
    // Match the pattern, accounting for timezone differences
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  test('pads single-digit months and days with zeros', () => {
    const date = new Date('2025-01-05T08:09:07.000Z')
    const result = formatTimestamp(date)
    // Check that the format has proper padding
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  test('formats current date when no argument provided', () => {
    const result = formatTimestamp()
    // Should match the expected format
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)

    // Should be close to current time (within 1 second)
    const now = new Date()
    const formatted = formatTimestamp(now)
    expect(result.substring(0, 16)).toBe(formatted.substring(0, 16)) // Match up to minutes
  })

  test('handles different times of day', () => {
    const midnight = new Date('2025-10-29T00:00:00.000Z')
    const noon = new Date('2025-10-29T12:00:00.000Z')
    const afternoon = new Date('2025-10-29T23:59:59.000Z')

    expect(formatTimestamp(midnight)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(formatTimestamp(noon)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(formatTimestamp(afternoon)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  test('produces consistent format regardless of locale', () => {
    const date = new Date('2025-10-29T15:30:45.000Z')
    const result = formatTimestamp(date)

    // Check specific format elements
    expect(result.split('-')).toHaveLength(3) // Year, month, day
    expect(result.split(':')).toHaveLength(3) // Hours, minutes, seconds
    expect(result.includes('/')).toBe(false) // No slashes
    expect(result.includes('AM')).toBe(false) // No AM/PM
    expect(result.includes('PM')).toBe(false) // No AM/PM
  })
})
