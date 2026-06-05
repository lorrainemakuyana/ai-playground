import {
  isPlanLimitDetail,
  reasonForDetail,
  registerUpgradeModalOpener,
  triggerUpgradeModal,
} from '@/lib/upgradeModalBridge'

describe('upgradeModalBridge', () => {
  describe('isPlanLimitDetail', () => {
    it('matches project plan-limit detail', () => {
      expect(isPlanLimitDetail('Free plan limit: 2 projects')).toBe(true)
    })
    it('matches agent plan-limit detail', () => {
      expect(isPlanLimitDetail('Free plan limit: 3 agents per project')).toBe(true)
    })
    it('matches the sharing gate detail', () => {
      expect(isPlanLimitDetail('Sharing requires Pro or Ultra')).toBe(true)
    })
    it('ignores unrelated 403s', () => {
      expect(isPlanLimitDetail('Access denied')).toBe(false)
    })
  })

  describe('reasonForDetail', () => {
    it('maps the projects limit', () => {
      expect(reasonForDetail('Free plan limit: 2 projects').title).toMatch(/project limit/i)
    })
    it('maps the agents limit', () => {
      expect(reasonForDetail('Free plan limit: 3 agents per project').title).toMatch(/agent limit/i)
    })
    it('maps the sharing gate', () => {
      expect(reasonForDetail('Sharing requires Pro or Ultra').title).toMatch(/sharing/i)
    })
    it('always recommends pro', () => {
      expect(reasonForDetail('Free plan limit: 2 projects').recommend).toBe('pro')
    })
  })

  describe('trigger/register', () => {
    afterEach(() => registerUpgradeModalOpener(null))

    it('invokes the registered opener', () => {
      const fn = jest.fn()
      registerUpgradeModalOpener(fn)
      triggerUpgradeModal({ title: 'x' })
      expect(fn).toHaveBeenCalledWith({ title: 'x' })
    })

    it('is a no-op when no opener is registered', () => {
      registerUpgradeModalOpener(null)
      expect(() => triggerUpgradeModal()).not.toThrow()
    })
  })
})
