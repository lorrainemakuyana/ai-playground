import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddAgentModal from '@/components/AddAgentModal'

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  onSubmit: jest.fn().mockResolvedValue(undefined),
}

beforeEach(() => {
  jest.clearAllMocks()
  defaultProps.onSubmit = jest.fn().mockResolvedValue(undefined)
  defaultProps.onClose = jest.fn()
})

describe('AddAgentModal', () => {
  it('does not render when isOpen is false', () => {
    render(<AddAgentModal isOpen={false} onClose={jest.fn()} onSubmit={jest.fn()} />)
    expect(screen.queryByText('Add Agent')).not.toBeInTheDocument()
  })

  it('renders when isOpen is true', () => {
    render(<AddAgentModal {...defaultProps} />)
    expect(screen.getByRole('heading', { name: /add agent/i })).toBeInTheDocument()
  })

  it('renders the role/specialization input', () => {
    render(<AddAgentModal {...defaultProps} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders Cancel button', () => {
    render(<AddAgentModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('renders Add Agent submit button', () => {
    render(<AddAgentModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: /add agent/i })).toBeInTheDocument()
  })

  it('submit button is disabled when input is empty', () => {
    render(<AddAgentModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: /add agent/i })).toBeDisabled()
  })

  it('submit button is disabled when input has only one character', async () => {
    const user = userEvent.setup()
    render(<AddAgentModal {...defaultProps} />)
    await user.type(screen.getByRole('textbox'), 'A')
    expect(screen.getByRole('button', { name: /add agent/i })).toBeDisabled()
  })

  it('submit button is disabled when input is only whitespace', async () => {
    const user = userEvent.setup()
    render(<AddAgentModal {...defaultProps} />)
    await user.type(screen.getByRole('textbox'), ' ')
    expect(screen.getByRole('button', { name: /add agent/i })).toBeDisabled()
  })

  it('submit button becomes enabled when 2+ character input is entered', async () => {
    const user = userEvent.setup()
    render(<AddAgentModal {...defaultProps} />)
    await user.type(screen.getByRole('textbox'), 'AB')
    expect(screen.getByRole('button', { name: /add agent/i })).not.toBeDisabled()
  })

  it('calls onSubmit with trimmed value on valid submit', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    render(<AddAgentModal isOpen={true} onClose={jest.fn()} onSubmit={onSubmit} />)
    await user.type(screen.getByRole('textbox'), '  Security Auditor  ')
    await user.click(screen.getByRole('button', { name: /add agent/i }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('Security Auditor')
    })
  })

  it('calls onClose after successful submit', async () => {
    const user = userEvent.setup()
    const onClose = jest.fn()
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    render(<AddAgentModal isOpen={true} onClose={onClose} onSubmit={onSubmit} />)
    await user.type(screen.getByRole('textbox'), 'DevOps Engineer')
    await user.click(screen.getByRole('button', { name: /add agent/i }))
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('calls onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = jest.fn()
    render(<AddAgentModal isOpen={true} onClose={onClose} onSubmit={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows error from onSubmit rejection', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn().mockRejectedValue(new Error('Server error'))
    render(<AddAgentModal isOpen={true} onClose={jest.fn()} onSubmit={onSubmit} />)
    await user.type(screen.getByRole('textbox'), 'Valid Role')
    await user.click(screen.getByRole('button', { name: /add agent/i }))
    expect(await screen.findByText('Server error')).toBeInTheDocument()
  })

  it('does not call onSubmit when input is too short (button disabled)', async () => {
    const onSubmit = jest.fn()
    render(<AddAgentModal isOpen={true} onClose={jest.fn()} onSubmit={onSubmit} />)
    // Button is disabled when input is empty — onSubmit should never be called
    expect(screen.getByRole('button', { name: /add agent/i })).toBeDisabled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('clears error message when user starts typing after an error', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn().mockRejectedValue(new Error('Server error'))
    render(<AddAgentModal isOpen={true} onClose={jest.fn()} onSubmit={onSubmit} />)
    // Submit a valid value to get a server error shown
    await user.type(screen.getByRole('textbox'), 'Valid Role')
    await user.click(screen.getByRole('button', { name: /add agent/i }))
    expect(await screen.findByText('Server error')).toBeInTheDocument()
    // Typing should clear the error
    await user.type(screen.getByRole('textbox'), 'X')
    expect(screen.queryByText('Server error')).not.toBeInTheDocument()
  })
})
