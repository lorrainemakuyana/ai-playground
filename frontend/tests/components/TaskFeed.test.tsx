import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskFeed from '@/components/TaskFeed'
import type { Task } from '@/types'

const mockTask: Task = {
  id: 'task-1',
  project_id: 'proj-1',
  assigned_agent_id: 'agent-1',
  phase: 'discovery',
  title: 'Requirements Analysis',
  description: 'Analyze requirements',
  status: 'pending',
  output: null,
  role: 'tech-lead',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

describe('TaskFeed', () => {
  it('shows empty state text when tasks array is empty', () => {
    render(<TaskFeed tasks={[]} onTaskClick={jest.fn()} isConnected={true} />)
    expect(screen.getByText('Waiting for tasks...')).toBeInTheDocument()
  })

  it('renders task title when tasks are provided', () => {
    render(<TaskFeed tasks={[mockTask]} onTaskClick={jest.fn()} isConnected={true} />)
    expect(screen.getByText('Requirements Analysis')).toBeInTheDocument()
  })

  it('renders multiple task titles', () => {
    const task2: Task = { ...mockTask, id: 'task-2', title: 'Architecture Design' }
    render(<TaskFeed tasks={[mockTask, task2]} onTaskClick={jest.fn()} isConnected={true} />)
    expect(screen.getByText('Requirements Analysis')).toBeInTheDocument()
    expect(screen.getByText('Architecture Design')).toBeInTheDocument()
  })

  it('shows "Live" indicator when isConnected is true', () => {
    render(<TaskFeed tasks={[]} onTaskClick={jest.fn()} isConnected={true} />)
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('shows "Reconnecting..." indicator when isConnected is false', () => {
    render(<TaskFeed tasks={[]} onTaskClick={jest.fn()} isConnected={false} />)
    expect(screen.getByText('Reconnecting...')).toBeInTheDocument()
  })

  it('does not show "Reconnecting..." when connected', () => {
    render(<TaskFeed tasks={[]} onTaskClick={jest.fn()} isConnected={true} />)
    expect(screen.queryByText('Reconnecting...')).not.toBeInTheDocument()
  })

  it('does not show "Live" when disconnected', () => {
    render(<TaskFeed tasks={[]} onTaskClick={jest.fn()} isConnected={false} />)
    expect(screen.queryByText('Live')).not.toBeInTheDocument()
  })

  it('calls onTaskClick with task id when task row clicked', async () => {
    const user = userEvent.setup()
    const onTaskClick = jest.fn()
    render(<TaskFeed tasks={[mockTask]} onTaskClick={onTaskClick} isConnected={true} />)
    await user.click(screen.getByText('Requirements Analysis'))
    expect(onTaskClick).toHaveBeenCalledWith('task-1')
  })

  it('calls onTaskClick exactly once per click', async () => {
    const user = userEvent.setup()
    const onTaskClick = jest.fn()
    render(<TaskFeed tasks={[mockTask]} onTaskClick={onTaskClick} isConnected={true} />)
    await user.click(screen.getByText('Requirements Analysis'))
    expect(onTaskClick).toHaveBeenCalledTimes(1)
  })

  it('shows task role label', () => {
    render(<TaskFeed tasks={[mockTask]} onTaskClick={jest.fn()} isConnected={true} />)
    expect(screen.getByText('tech-lead')).toBeInTheDocument()
  })

  it('shows "unassigned" when task role is null', () => {
    const taskNoRole: Task = { ...mockTask, role: null }
    render(<TaskFeed tasks={[taskNoRole]} onTaskClick={jest.fn()} isConnected={true} />)
    expect(screen.getByText('unassigned')).toBeInTheDocument()
  })

  it('does not show empty state when tasks are present', () => {
    render(<TaskFeed tasks={[mockTask]} onTaskClick={jest.fn()} isConnected={true} />)
    expect(screen.queryByText('Waiting for tasks...')).not.toBeInTheDocument()
  })

  it('always shows the "Tasks" header', () => {
    render(<TaskFeed tasks={[]} onTaskClick={jest.fn()} isConnected={true} />)
    expect(screen.getByText('Tasks')).toBeInTheDocument()
  })
})
