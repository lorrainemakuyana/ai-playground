import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AuthPage from '@/app/auth/page'
import { login } from '@/lib/api'

// Drives the value returned by useSearchParams().get('next'). Prefixed with
// `mock` so jest's hoisting guard allows it inside the factory below.
let mockNextValue: string | null = null

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (key: string) => (key === 'next' ? mockNextValue : null) }),
}))

jest.mock('@/lib/api', () => ({
  login: jest.fn(),
  register: jest.fn(),
  ApiError: class ApiError extends Error {},
}))

const assignMock = jest.fn()

function submitLogin(container: HTMLElement) {
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
    target: { value: 'user@example.com' },
  })
  fireEvent.change(screen.getByPlaceholderText('••••••••'), {
    target: { value: 'securepass123' },
  })
  // Two buttons read "Sign in" (the mode tab and the submit), so submit the
  // form directly rather than disambiguating by role/name.
  fireEvent.submit(container.querySelector('form')!)
}

describe('AuthPage login navigation', () => {
  beforeEach(() => {
    mockNextValue = null
    assignMock.mockClear()
    ;(login as jest.Mock).mockReset().mockResolvedValue({
      access_token: 't',
      user_id: 'u',
      email: 'user@example.com',
    })
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign: assignMock },
    })
  })

  it('hard-navigates to /app on successful login', async () => {
    const { container } = render(<AuthPage />)
    submitLogin(container)
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('/app'))
  })

  it('honours a safe relative `next` target', async () => {
    mockNextValue = '/app/projects/abc'
    const { container } = render(<AuthPage />)
    submitLogin(container)
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('/app/projects/abc'))
  })

  it('rejects a protocol-relative open-redirect and falls back to /app', async () => {
    mockNextValue = '//evil.com'
    const { container } = render(<AuthPage />)
    submitLogin(container)
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('/app'))
  })

  it('rejects an absolute-URL `next` and falls back to /app', async () => {
    mockNextValue = 'https://evil.com'
    const { container } = render(<AuthPage />)
    submitLogin(container)
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('/app'))
  })
})
