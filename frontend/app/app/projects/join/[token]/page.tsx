'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { joinViaLink } from '@/lib/api'

export default function JoinProjectPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [error, setError] = useState('')

  useEffect(() => {
    async function join() {
      try {
        const { project_id } = await joinViaLink(token)
        router.replace(`/app/projects/${project_id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid or expired share link.')
      }
    }
    void join()
  }, [token, router])

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full bg-red-950 flex items-center justify-center mb-2">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-sm font-medium text-red-400">{error}</p>
        <Link href="/app" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
          ← Back to Projects
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-2">
        <svg className="w-6 h-6 text-neutral-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
      <p className="text-sm text-neutral-400">Joining project…</p>
    </div>
  )
}
