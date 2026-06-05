import { render, screen } from '@testing-library/react'
import PlanTierBadge from '@/components/PlanTierBadge'

describe('PlanTierBadge', () => {
  it('renders Free label', () => {
    render(<PlanTierBadge plan="free" />)
    expect(screen.getByText('Free')).toBeInTheDocument()
  })

  it('renders Pro label', () => {
    render(<PlanTierBadge plan="pro" />)
    expect(screen.getByText('Pro')).toBeInTheDocument()
  })

  it('renders Ultra label', () => {
    render(<PlanTierBadge plan="ultra" />)
    expect(screen.getByText('Ultra')).toBeInTheDocument()
  })

  it('shows the Expired chip when expired', () => {
    render(<PlanTierBadge plan="pro" expired />)
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })

  it('does not show the Expired chip by default', () => {
    render(<PlanTierBadge plan="pro" />)
    expect(screen.queryByText('Expired')).not.toBeInTheDocument()
  })
})
