import { render, screen, fireEvent } from '@testing-library/react'
import CurrencyToggle from '@/components/CurrencyToggle'

describe('CurrencyToggle', () => {
  beforeEach(() => window.localStorage.clear())

  it('defaults to GBP (aria-checked false for USD switch)', () => {
    render(<CurrencyToggle />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('switches to USD on click and persists to localStorage', () => {
    render(<CurrencyToggle />)
    fireEvent.click(screen.getByText('$ USD'))
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(window.localStorage.getItem('preferred_currency')).toBe('USD')
  })

  it('switches back to GBP', () => {
    render(<CurrencyToggle />)
    fireEvent.click(screen.getByText('$ USD'))
    fireEvent.click(screen.getByText('£ GBP'))
    expect(window.localStorage.getItem('preferred_currency')).toBe('GBP')
  })
})
