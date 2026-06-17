import { login } from '@/lib/api'

describe('fetchJSON request timeout', () => {
  const originalFetch = global.fetch

  beforeEach(() => jest.useFakeTimers())
  afterEach(() => {
    jest.useRealTimers()
    global.fetch = originalFetch
  })

  it('aborts a hung request and surfaces a recoverable ApiError instead of hanging', async () => {
    // Simulate a request that never responds on its own (e.g. swallowed by a
    // service worker) and only settles when its AbortSignal fires.
    global.fetch = jest.fn(
      (_url: RequestInfo | URL, opts?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    ) as unknown as typeof fetch

    const promise = login('user@example.com', 'securepass123')
    const assertion = expect(promise).rejects.toMatchObject({ name: 'ApiError', status: 0 })

    // Fire the 30s timeout; the request should abort and reject rather than hang.
    jest.advanceTimersByTime(30_000)
    await assertion
  })

  it('clears the timeout when the request resolves normally', async () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout')
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 't', user_id: 'u', email: 'a@b.com' }),
    })) as unknown as typeof fetch

    await login('user@example.com', 'securepass123')
    expect(clearSpy).toHaveBeenCalled()
  })
})
