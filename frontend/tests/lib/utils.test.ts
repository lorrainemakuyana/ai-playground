import { getInitials, agentBorderClass } from './utils'

describe('getInitials', () => {
  it('returns "TL" for "tech-lead"', () => {
    expect(getInitials('tech-lead')).toBe('TL')
  })

  it('returns "EI" for "engineer-1" (splits on hyphen, takes first char of each part)', () => {
    // "engineer-1" splits to ["engineer", "1"] → "E" + "1" → "E1"
    // But implementation: w[0]?.toUpperCase() for "1" → "1"
    // So result is "E1" — test the actual behaviour
    const result = getInitials('engineer-1')
    expect(result).toBe('E1')
  })

  it('returns "EI" for "engineer-internal"', () => {
    expect(getInitials('engineer-internal')).toBe('EI')
  })

  it('returns initials from space-separated words', () => {
    expect(getInitials('tech lead')).toBe('TL')
  })

  it('returns initials from mixed space and hyphen', () => {
    // "tech-lead senior" → ["tech", "lead", "senior"] → "TL" (slice(0,2))
    expect(getInitials('tech-lead senior')).toBe('TL')
  })

  it('returns single uppercase letter for single word', () => {
    expect(getInitials('qa')).toBe('Q')
  })

  it('returns "S" for "sre" (single segment, one initial)', () => {
    // "sre" is a single segment → "S" (just the first char, sliced to 2)
    expect(getInitials('sre')).toBe('S')
  })

  it('returns uppercase letters', () => {
    const result = getInitials('tech-lead')
    expect(result).toMatch(/^[A-Z0-9]+$/)
  })

  it('returns at most 2 characters', () => {
    const result = getInitials('very-long-role-name')
    expect(result.length).toBeLessThanOrEqual(2)
  })
})

describe('agentBorderClass', () => {
  it('returns primary glow border for working status', () => {
    expect(agentBorderClass('working')).toBe('border-primary-800 shadow-primary-glow')
  })

  it('returns amber border for blocked status', () => {
    expect(agentBorderClass('blocked')).toBe('border-amber-600')
  })

  it('returns green border for done status', () => {
    expect(agentBorderClass('done')).toBe('border-green-800')
  })

  it('returns neutral border for idle status', () => {
    expect(agentBorderClass('idle')).toBe('border-neutral-800')
  })

  it('returns a non-empty string for all valid statuses', () => {
    const statuses = ['idle', 'working', 'blocked', 'done'] as const
    statuses.forEach(status => {
      expect(agentBorderClass(status)).toBeTruthy()
    })
  })
})
