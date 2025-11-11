import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BlockTypeDialog } from './BlockTypeDialog'

describe('BlockTypeDialog', () => {
  test('returns null when not open', () => {
    const { container } = render(
      <BlockTypeDialog
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  test('submits custom name and selected type', async () => {
    const user = userEvent.setup()
    const handleConfirm = vi.fn()
    const handleClose = vi.fn()

    render(
      <BlockTypeDialog
        isOpen
        onClose={handleClose}
        onConfirm={handleConfirm}
      />
    )

    await user.type(
      screen.getByPlaceholderText('Enter block name'),
      '  My Block  '
    )
    await user.click(screen.getByText('Markdown'))
    await user.click(screen.getByRole('button', { name: 'Create Block' }))

    expect(handleConfirm).toHaveBeenCalledWith('My Block', 'markdown')
    expect(handleClose).toHaveBeenCalled()
  })

  test('submit via enter key', async () => {
    const user = userEvent.setup()
    const handleConfirm = vi.fn()

    render(
      <BlockTypeDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={handleConfirm}
      />
    )

    const input = screen.getByPlaceholderText('Enter block name')
    await user.type(input, 'Terminal Block')
    await user.click(screen.getByText('Terminal'))
    await user.click(input)
    await user.keyboard('{Enter}')

    expect(handleConfirm).toHaveBeenCalledWith('Terminal Block', 'terminal')
  })

  test('cancel closes dialog without submitting', async () => {
    const user = userEvent.setup()
    const handleConfirm = vi.fn()
    const handleClose = vi.fn()

    render(
      <BlockTypeDialog
        isOpen
        onClose={handleClose}
        onConfirm={handleConfirm}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(handleConfirm).not.toHaveBeenCalled()
    expect(handleClose).toHaveBeenCalled()
  })
})

