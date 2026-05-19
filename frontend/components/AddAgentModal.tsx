'use client'

import { useEffect, useRef, useState } from 'react'

interface AddAgentModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (specialization: string) => Promise<void>
}

export default function AddAgentModal({ isOpen, onClose, onSubmit }: AddAgentModalProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) { setValue(''); setError(''); inputRef.current?.focus() }
  }, [isOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (value.trim().length < 2) { setError('Role name must be at least 2 characters.'); return }
    setLoading(true)
    try {
      await onSubmit(value.trim())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add agent.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl flex flex-col animate-scaleIn">
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-neutral-100">Add Agent</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5">
            <label className="text-sm font-medium text-neutral-300 mb-2 block">Role / Specialization</label>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={e => { setValue(e.target.value); setError('') }}
              placeholder="e.g. Security Auditor, Database Engineer"
              maxLength={50}
              className={`w-full bg-neutral-950 border rounded-md px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow duration-150 ${error ? 'border-red-500 focus:ring-red-500' : 'border-neutral-700'}`}
            />
            {error ? (
              <p className="text-xs text-red-400 mt-1.5">{error}</p>
            ) : (
              <p className="text-xs text-neutral-500 mt-1.5">e.g. Security Auditor, Database Engineer, Documentation Writer</p>
            )}
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-400 rounded-md hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || value.trim().length < 2}
              className="px-4 py-2 text-sm font-medium text-white rounded-md bg-primary-600 hover:bg-primary-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Adding...
                </span>
              ) : 'Add Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
