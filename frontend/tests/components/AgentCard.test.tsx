import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AgentCard from '@/components/AgentCard'
import type { Agent } from '@/types'

const mockAgent: Agent = {
  id: 'agent-1',
  project_id: 'proj-1',
  role: 'tech-lead',
  specialization: 'Technical Leadership',
  status: 'idle',
}

describe('AgentCard', () => {
  it('renders agent specialization', () => {
    render(<AgentCard agent={mockAgent} onClick={jest.fn()} />)
    expect(screen.getByText('Technical Leadership')).toBeInTheDocument()
  })

  it('renders agent role when no specialization', () => {
    const agent: Agent = { ...mockAgent, specialization: '' }
    render(<AgentCard agent={agent} onClick={jest.fn()} />)
    expect(screen.getByText('tech-lead')).toBeInTheDocument()
  })

  it('renders initials from role', () => {
    render(<AgentCard agent={mockAgent} onClick={jest.fn()} />)
    // tech-lead → TL
    expect(screen.getByText('TL')).toBeInTheDocument()
  })

  it('shows status badge', () => {
    render(<AgentCard agent={mockAgent} onClick={jest.fn()} />)
    expect(screen.getByText('idle')).toBeInTheDocument()
  })

  it('shows "No output yet..." placeholder when latestOutput is not provided', () => {
    render(<AgentCard agent={mockAgent} onClick={jest.fn()} />)
    expect(screen.getByText('No output yet...')).toBeInTheDocument()
  })

  it('shows latestOutput when provided', () => {
    render(<AgentCard agent={mockAgent} latestOutput="Some output here" onClick={jest.fn()} />)
    expect(screen.getByText('Some output here')).toBeInTheDocument()
  })

  it('does not show "No output yet..." when latestOutput is provided', () => {
    render(<AgentCard agent={mockAgent} latestOutput="Some output here" onClick={jest.fn()} />)
    expect(screen.queryByText('No output yet...')).not.toBeInTheDocument()
  })

  it('calls onClick with agent id when button is clicked', async () => {
    const user = userEvent.setup()
    const onClick = jest.fn()
    render(<AgentCard agent={mockAgent} onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledWith('agent-1')
  })

  it('calls onClick exactly once per click', async () => {
    const user = userEvent.setup()
    const onClick = jest.fn()
    render(<AgentCard agent={mockAgent} onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders currentTask text when status is working and currentTask provided', () => {
    const workingAgent: Agent = { ...mockAgent, status: 'working' }
    render(<AgentCard agent={workingAgent} currentTask="Running analysis" onClick={jest.fn()} />)
    expect(screen.getByText('Running analysis')).toBeInTheDocument()
  })

  it('does not render currentTask when status is not working', () => {
    render(<AgentCard agent={mockAgent} currentTask="Running analysis" onClick={jest.fn()} />)
    expect(screen.queryByText('Running analysis')).not.toBeInTheDocument()
  })

  it('renders as a button element', () => {
    render(<AgentCard agent={mockAgent} onClick={jest.fn()} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
