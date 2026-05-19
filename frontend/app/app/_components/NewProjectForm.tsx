'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProject } from '@/lib/api'

export default function NewProjectForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  function resetForm() {
    setName('')
    setDescription('')
    setError('')
  }

  function handleClose() {
    setIsOpen(false)
    resetForm()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length === 0) { setError('Project name is required.'); return }
    if (description.trim().length < 10) { setError('Description must be at least 10 characters.'); return }
    setLoading(true)
    setError('')
    try {
      const project = await createProject({ name: name.trim(), description: description.trim() })
      router.push(`/app/projects/${project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project.')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg bg-primary-600 hover:bg-primary-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-950"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New Project
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl animate-scaleIn">
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800">
              <h2 className="text-lg font-semibold text-neutral-100">Create New Project</h2>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-neutral-300 mb-1.5 block">
                    Project Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => { setName(e.target.value); setError('') }}
                    placeholder="e.g. E-Commerce Platform, REST API Gateway"
                    maxLength={80}
                    required
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow duration-150"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-300 mb-1.5 block">
                    Description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={e => { setDescription(e.target.value); setError('') }}
                    placeholder="Describe what you want to build. The more detail you provide, the better the agents can plan and implement."
                    rows={4}
                    maxLength={500}
                    required
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow duration-150 resize-none"
                  />
                  <p className="text-xs text-neutral-600 mt-1">{description.length}/500 characters (min 10)</p>
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">
                    <svg className="w-4 h-4 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-neutral-400 rounded-md hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || name.trim().length === 0 || description.trim().length < 10}
                  className="px-4 py-2 text-sm font-medium text-white rounded-md bg-primary-600 hover:bg-primary-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating...
                    </span>
                  ) : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
