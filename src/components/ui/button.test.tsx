import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './button'

describe('Button Component', () => {
  test('renders button with text', () => {
    render(<Button>Click me</Button>)

    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
  })

  test('applies variant classes correctly', () => {
    render(<Button variant="destructive">Delete</Button>)

    const button = screen.getByRole('button', { name: /delete/i })
    expect(button).toHaveClass('bg-destructive')
  })

  test('applies size classes correctly', () => {
    render(<Button size="lg">Large Button</Button>)

    const button = screen.getByRole('button', { name: /large button/i })
    expect(button).toHaveClass('h-11')
  })

  test('can be disabled', () => {
    render(<Button disabled>Disabled Button</Button>)

    const button = screen.getByRole('button', { name: /disabled button/i })
    expect(button).toBeDisabled()
  })

  test('forwards ref correctly', () => {
    const ref = { current: null }
    render(<Button ref={ref}>Ref Button</Button>)

    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })
})
