'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { login, register } from '@/lib/api'
import { setToken } from '@/lib/auth'

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { setError('') }, [mode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (mode === 'register' && password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const data = mode === 'login'
        ? await login(email, password)
        : await register(email, password)
      setToken(data.access_token)
      const next = searchParams.get('next') ?? '/app'
      const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/app'
      router.push(safeNext)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-neutral-950">
      {/* Left panel — full bleed illustration */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <AgentNetworkIllustration />
      </div>

      {/* Right panel — auth form */}
      <div className="w-full lg:w-1/2 flex items-center px-12 py-12 pl-40">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center flex-none">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-neutral-100 tracking-tight">Orchestrator</span>
          </div>

          <h1 className="text-2xl font-bold text-neutral-100 mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="text-sm text-neutral-500 mb-8">
            {mode === 'login'
              ? 'Sign in to access your projects.'
              : 'Set up your account to get started.'}
          </p>

          <div className="flex rounded-lg bg-neutral-900 border border-neutral-800 p-1 mb-6">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  mode === m
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Password</label>
              <input
                type="password"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Confirm password</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
                />
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-950/50 border border-red-900/50 rounded-lg px-3 py-2.5">
                <svg className="w-4 h-4 flex-none mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold text-white rounded-lg bg-primary-600 hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                </span>
              ) : (
                mode === 'login' ? 'Sign in' : 'Create account'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function AgentNetworkIllustration() {
  // Center and orbit radius
  const cx = 360, cy = 450, orb = 195

  // 6 nodes in hexagonal arrangement (top, top-right, bot-right, bottom, bot-left, top-left)
  const nodes = [
    { x: 360, y: cy - orb,                            stroke: '#7c3aed', fill: '#0c0518', icon: 'star',   light: '#c4b5fd', gid: 'g0' },
    { x: cx + orb * 0.866, y: cy - orb * 0.5,         stroke: '#3b82f6', fill: '#050c1e', icon: 'code',   light: '#93c5fd', gid: 'g1' },
    { x: cx + orb * 0.866, y: cy + orb * 0.5,         stroke: '#3b82f6', fill: '#050c1e', icon: 'term',   light: '#93c5fd', gid: 'g2' },
    { x: 360, y: cy + orb,                            stroke: '#10b981', fill: '#04110a', icon: 'shield', light: '#6ee7b7', gid: 'g3' },
    { x: cx - orb * 0.866, y: cy + orb * 0.5,         stroke: '#f97316', fill: '#130800', icon: 'server', light: '#fdba74', gid: 'g4' },
    { x: cx - orb * 0.866, y: cy - orb * 0.5,         stroke: '#ec4899', fill: '#12040e', icon: 'spark',  light: '#f9a8d4', gid: 'g5' },
  ]

  // Round positions for clean SVG
  const N = nodes.map(n => ({ ...n, x: Math.round(n.x), y: Math.round(n.y) }))

  return (
    <svg
      viewBox="0 0 720 900"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        {/* Background gradient */}
        <radialGradient id="bg" cx="50%" cy="50%" r="70%">
          <stop offset="0%"   stopColor="#0e0720" />
          <stop offset="55%"  stopColor="#07041a" />
          <stop offset="100%" stopColor="#020207" />
        </radialGradient>

        {/* Dot grid pattern */}
        <pattern id="dotgrid" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse">
          <circle cx="18" cy="18" r="0.9" fill="white" fillOpacity="0.06" />
        </pattern>

        {/* Central bloom */}
        <radialGradient id="cbloom" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#5b21b6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#5b21b6" stopOpacity="0"    />
        </radialGradient>

        {/* Per-node radial glow gradients */}
        <radialGradient id="g0" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#7c3aed" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0"    />
        </radialGradient>
        <radialGradient id="g1" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.5"  />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"    />
        </radialGradient>
        <radialGradient id="g2" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.5"  />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"    />
        </radialGradient>
        <radialGradient id="g3" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#10b981" stopOpacity="0.5"  />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0"    />
        </radialGradient>
        <radialGradient id="g4" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#f97316" stopOpacity="0.5"  />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0"    />
        </radialGradient>
        <radialGradient id="g5" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#ec4899" stopOpacity="0.5"  />
          <stop offset="100%" stopColor="#ec4899" stopOpacity="0"    />
        </radialGradient>

        {/* Bloom filter (node glow) */}
        <filter id="bloom" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        {/* Soft bloom for satellite nodes */}
        <filter id="sbloom" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── Layer 0: Background ── */}
      <rect width="720" height="900" fill="url(#bg)" />
      <rect width="720" height="900" fill="url(#dotgrid)" />

      {/* ── Layer 1: Ambient glow ── */}
      <ellipse cx="360" cy="450" rx="310" ry="310" fill="url(#cbloom)" />

      {/* ── Layer 2: Orbital rings ── */}
      <circle cx="360" cy="450" r="100" fill="none" stroke="white" strokeOpacity="0.04" strokeWidth="1" strokeDasharray="3 8" />
      <circle cx="360" cy="450" r="195" fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="1" strokeDasharray="3 6" />
      <circle cx="360" cy="450" r="270" fill="none" stroke="white" strokeOpacity="0.025" strokeWidth="1" />

      {/* ── Layer 3: Ring edges (adjacent node connections) ── */}
      {N.map((n, i) => {
        const m = N[(i + 1) % 6]
        return <line key={i} x1={n.x} y1={n.y} x2={m.x} y2={m.y}
          stroke="white" strokeOpacity="0.07" strokeWidth="1" />
      })}

      {/* ── Layer 4: Spokes ── */}
      {N.map((n, i) => (
        <line key={i} x1={cx} y1={cy} x2={n.x} y2={n.y}
          stroke={n.stroke} strokeOpacity="0.28" strokeWidth="1.5"
          strokeDasharray="4 7" />
      ))}

      {/* ── Layer 5: Node glow halos ── */}
      {N.map(n => (
        <ellipse key={n.gid} cx={n.x} cy={n.y} rx="54" ry="54" fill={`url(#${n.gid})`} />
      ))}

      {/* ── Layer 6: Centre node ── */}
      <circle cx={cx} cy={cy} r="46" fill="#0f0621" stroke="#7c3aed" strokeWidth="2.5" filter="url(#bloom)" />
      <circle cx={cx} cy={cy} r="37" fill="#18093a" opacity="0.55" />
      {/* Lightning bolt — Heroicons bolt, 24×24, scaled 1.15, centred at (cx,cy) */}
      <path
        transform={`translate(${cx - 13.8} ${cy - 13.8}) scale(1.15)`}
        fill="#c4b5fd"
        filter="url(#sbloom)"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />

      {/* ── Layer 7: Satellite nodes ── */}

      {/* Node 0 — Tech Lead (violet, top) */}
      <circle cx={N[0].x} cy={N[0].y} r="31" fill={N[0].fill} stroke={N[0].stroke} strokeWidth="2" filter="url(#sbloom)" />
      {/* 5-point star, filled */}
      <path
        transform={`translate(${N[0].x - 9} ${N[0].y - 9}) scale(0.75)`}
        fill={N[0].light}
        d="M12 2 L14.4 8.8 L21.5 8.9 L15.8 13.2 L17.9 20.1 L12 16 L6.1 20.1 L8.2 13.2 L2.5 8.9 L9.6 8.8 Z"
      />

      {/* Node 1 — Engineer 1 (blue, top-right) */}
      <circle cx={N[1].x} cy={N[1].y} r="29" fill={N[1].fill} stroke={N[1].stroke} strokeWidth="2" filter="url(#sbloom)" />
      {/* Code </> icon */}
      <path
        transform={`translate(${N[1].x - 9} ${N[1].y - 9}) scale(0.75)`}
        fill="none" stroke={N[1].light} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />

      {/* Node 2 — Engineer 2 (blue, bottom-right) */}
      <circle cx={N[2].x} cy={N[2].y} r="29" fill={N[2].fill} stroke={N[2].stroke} strokeWidth="2" filter="url(#sbloom)" />
      {/* Terminal icon */}
      <path
        transform={`translate(${N[2].x - 9} ${N[2].y - 9}) scale(0.75)`}
        fill="none" stroke={N[2].light} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />

      {/* Node 3 — QA (emerald, bottom) */}
      <circle cx={N[3].x} cy={N[3].y} r="29" fill={N[3].fill} stroke={N[3].stroke} strokeWidth="2" filter="url(#sbloom)" />
      {/* Shield-check icon */}
      <path
        transform={`translate(${N[3].x - 9} ${N[3].y - 9}) scale(0.75)`}
        fill="none" stroke={N[3].light} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />

      {/* Node 4 — SRE (orange, bottom-left) */}
      <circle cx={N[4].x} cy={N[4].y} r="29" fill={N[4].fill} stroke={N[4].stroke} strokeWidth="2" filter="url(#sbloom)" />
      {/* Server icon */}
      <path
        transform={`translate(${N[4].x - 9} ${N[4].y - 9}) scale(0.75)`}
        fill="none" stroke={N[4].light} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
      />

      {/* Node 5 — Custom (pink, top-left) */}
      <circle cx={N[5].x} cy={N[5].y} r="29" fill={N[5].fill} stroke={N[5].stroke} strokeWidth="2" filter="url(#sbloom)" />
      {/* Sparkles icon */}
      <path
        transform={`translate(${N[5].x - 9} ${N[5].y - 9}) scale(0.75)`}
        fill="none" stroke={N[5].light} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />

      {/* ── Layer 8: Data packet particles on spokes ── */}
      <circle cx={Math.round(cx + (N[0].x - cx) * 0.48)} cy={Math.round(cy + (N[0].y - cy) * 0.48)} r="3"   fill="#7c3aed" fillOpacity="0.9" />
      <circle cx={Math.round(cx + (N[1].x - cx) * 0.52)} cy={Math.round(cy + (N[1].y - cy) * 0.52)} r="2.5" fill="#3b82f6" fillOpacity="0.85" />
      <circle cx={Math.round(cx + (N[2].x - cx) * 0.45)} cy={Math.round(cy + (N[2].y - cy) * 0.45)} r="2.5" fill="#3b82f6" fillOpacity="0.8"  />
      <circle cx={Math.round(cx + (N[3].x - cx) * 0.55)} cy={Math.round(cy + (N[3].y - cy) * 0.55)} r="2.5" fill="#10b981" fillOpacity="0.85" />
      <circle cx={Math.round(cx + (N[4].x - cx) * 0.48)} cy={Math.round(cy + (N[4].y - cy) * 0.48)} r="2.5" fill="#f97316" fillOpacity="0.85" />
      <circle cx={Math.round(cx + (N[5].x - cx) * 0.5)}  cy={Math.round(cy + (N[5].y - cy) * 0.5)}  r="2.5" fill="#ec4899" fillOpacity="0.8"  />

      {/* Smaller accent particles */}
      <circle cx={Math.round(cx + (N[0].x - cx) * 0.75)} cy={Math.round(cy + (N[0].y - cy) * 0.75)} r="1.5" fill="#a78bfa" fillOpacity="0.55" />
      <circle cx={Math.round(cx + (N[2].x - cx) * 0.72)} cy={Math.round(cy + (N[2].y - cy) * 0.72)} r="1.5" fill="#60a5fa" fillOpacity="0.5"  />
      <circle cx={Math.round(cx + (N[3].x - cx) * 0.78)} cy={Math.round(cy + (N[3].y - cy) * 0.78)} r="1.5" fill="#34d399" fillOpacity="0.5"  />
      <circle cx={Math.round(cx + (N[5].x - cx) * 0.7)}  cy={Math.round(cy + (N[5].y - cy) * 0.7)}  r="1.5" fill="#f472b6" fillOpacity="0.5"  />
    </svg>
  )
}
