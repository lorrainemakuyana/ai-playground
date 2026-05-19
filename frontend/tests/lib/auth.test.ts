import { getToken, setToken, clearToken, isAuthenticated } from '@/lib/auth'

beforeEach(() => {
  // Clear all cookies before each test
  document.cookie.split(';').forEach(c => {
    document.cookie = c.trim().split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/'
  })
})

describe('setToken / getToken', () => {
  it('stores a token and retrieves it', () => {
    setToken('my-secret-token')
    expect(getToken()).toBe('my-secret-token')
  })

  it('returns null when no token is set', () => {
    expect(getToken()).toBeNull()
  })

  it('handles tokens with special characters', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMSJ9.abc_def-XYZ'
    setToken(token)
    expect(getToken()).toBe(token)
  })

  it('overwrites an existing token', () => {
    setToken('first-token')
    setToken('second-token')
    expect(getToken()).toBe('second-token')
  })
})

describe('clearToken', () => {
  it('removes the token so getToken returns null', () => {
    setToken('some-token')
    clearToken()
    expect(getToken()).toBeNull()
  })

  it('is safe to call when no token exists', () => {
    expect(() => clearToken()).not.toThrow()
    expect(getToken()).toBeNull()
  })
})

describe('isAuthenticated', () => {
  it('returns false when no token is set', () => {
    expect(isAuthenticated()).toBe(false)
  })

  it('returns true after a token is set', () => {
    setToken('valid-token')
    expect(isAuthenticated()).toBe(true)
  })

  it('returns false after token is cleared', () => {
    setToken('valid-token')
    clearToken()
    expect(isAuthenticated()).toBe(false)
  })
})
