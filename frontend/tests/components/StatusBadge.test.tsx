import { render, screen } from '@testing-library/react'
import StatusBadge from '@/components/StatusBadge'

describe('StatusBadge', () => {
  it('renders idle status text', () => {
    render(<StatusBadge status="idle" />)
    expect(screen.getByText('idle')).toBeInTheDocument()
  })

  it('renders working status text', () => {
    render(<StatusBadge status="working" />)
    expect(screen.getByText('working')).toBeInTheDocument()
  })

  it('renders working status with animate-pulse class', () => {
    const { container } = render(<StatusBadge status="working" />)
    expect(container.firstChild).toHaveClass('animate-pulse')
  })

  it('renders blocked status text', () => {
    render(<StatusBadge status="blocked" />)
    expect(screen.getByText('blocked')).toBeInTheDocument()
  })

  it('renders done status text', () => {
    render(<StatusBadge status="done" />)
    expect(screen.getByText('done')).toBeInTheDocument()
  })

  it('renders active status text', () => {
    render(<StatusBadge status="active" />)
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('renders paused status text', () => {
    render(<StatusBadge status="paused" />)
    expect(screen.getByText('paused')).toBeInTheDocument()
  })

  it('renders pending status text', () => {
    render(<StatusBadge status="pending" />)
    expect(screen.getByText('pending')).toBeInTheDocument()
  })

  it('replaces hyphen in in-progress with a space', () => {
    render(<StatusBadge status="in-progress" />)
    expect(screen.getByText('in progress')).toBeInTheDocument()
  })

  it('renders failed status text', () => {
    render(<StatusBadge status="failed" />)
    expect(screen.getByText('failed')).toBeInTheDocument()
  })

  it('applies correct CSS class for idle', () => {
    const { container } = render(<StatusBadge status="idle" />)
    expect(container.firstChild).toHaveClass('bg-neutral-800', 'text-neutral-400')
  })

  it('applies correct CSS class for blocked', () => {
    const { container } = render(<StatusBadge status="blocked" />)
    expect(container.firstChild).toHaveClass('bg-amber-950', 'text-amber-400')
  })

  it('applies correct CSS class for done', () => {
    const { container } = render(<StatusBadge status="done" />)
    expect(container.firstChild).toHaveClass('bg-green-950', 'text-green-400')
  })

  it('applies correct CSS class for failed', () => {
    const { container } = render(<StatusBadge status="failed" />)
    expect(container.firstChild).toHaveClass('bg-red-950', 'text-red-400')
  })

  it('applies correct CSS class for pending', () => {
    const { container } = render(<StatusBadge status="pending" />)
    expect(container.firstChild).toHaveClass('text-amber-400')
  })

  it('renders as a span element', () => {
    const { container } = render(<StatusBadge status="idle" />)
    expect(container.firstChild?.nodeName).toBe('SPAN')
  })
})
