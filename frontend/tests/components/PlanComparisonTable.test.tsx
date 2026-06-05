import { render, screen, fireEvent } from '@testing-library/react'
import PlanComparisonTable from '@/components/PlanComparisonTable'

describe('PlanComparisonTable', () => {
  beforeEach(() => window.localStorage.clear())

  it('renders all three tiers', () => {
    render(<PlanComparisonTable />)
    // "Free" appears twice on the Free card (badge + price), Pro/Ultra once each.
    expect(screen.getAllByText('Free').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Ultra')).toBeInTheDocument()
  })

  it('renders GBP prices by default', () => {
    render(<PlanComparisonTable />)
    expect(screen.getByText('£11.99')).toBeInTheDocument()
    expect(screen.getByText('£29.99')).toBeInTheDocument()
  })

  it('marks the current tier', () => {
    render(<PlanComparisonTable currentTier="pro" />)
    expect(screen.getByText('Current')).toBeInTheDocument()
  })

  it('shows Upgrade / Downgrade / Current CTAs relative to the current tier', () => {
    const onSubscribe = jest.fn()
    render(<PlanComparisonTable currentTier="pro" onSubscribe={onSubscribe} />)
    expect(screen.getByText('Downgrade')).toBeInTheDocument()   // free
    expect(screen.getByText('Current plan')).toBeInTheDocument() // pro
    expect(screen.getByText('Upgrade')).toBeInTheDocument()      // ultra
  })

  it('fires onSubscribe for an actionable tier but not the current one', () => {
    const onSubscribe = jest.fn()
    render(<PlanComparisonTable currentTier="free" onSubscribe={onSubscribe} />)
    fireEvent.click(screen.getAllByText('Upgrade')[0]) // Pro/Ultra are both "Upgrade" when current is Free
    expect(onSubscribe).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Current plan')) // disabled Free card
    expect(onSubscribe).toHaveBeenCalledTimes(1)       // disabled current didn't fire
  })

  it('renders Subscribe / Get started when no current tier (logged out)', () => {
    render(<PlanComparisonTable onSubscribe={jest.fn()} />)
    expect(screen.getByText('Get started')).toBeInTheDocument()
    expect(screen.getAllByText('Subscribe').length).toBe(2)
  })
})
