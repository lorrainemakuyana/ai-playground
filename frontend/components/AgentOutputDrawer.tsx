'use client'

import { useEffect, useRef, useState } from 'react'
import type { Task, AgentMessage } from '@/types'
import { retryTask, cancelTask } from '@/lib/api'

interface AgentOutputDrawerProps {
  isOpen: boolean
  task: Task | null
  messages: AgentMessage[]
  liveOutput?: string
  onClose: () => void
  onTaskUpdate?: (task: Task) => void
}

export default function AgentOutputDrawer({ isOpen, task, messages, liveOutput, onClose, onTaskUpdate }: AgentOutputDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const liveScrollRef = useRef<HTMLDivElement>(null)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState('')
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (isOpen) closeRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  useEffect(() => { setRetryError(''); setCancelling(false) }, [task?.id])

  // Auto-scroll live output to bottom as chunks arrive
  useEffect(() => {
    if (liveScrollRef.current) {
      liveScrollRef.current.scrollTop = liveScrollRef.current.scrollHeight
    }
  }, [liveOutput])

  async function handleRetry() {
    if (!task) return
    setRetrying(true)
    setRetryError('')
    try {
      const updated = await retryTask(task.project_id, task.id)
      onTaskUpdate?.(updated)
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : 'Retry failed')
    } finally {
      setRetrying(false)
    }
  }

  async function handleCancel() {
    if (!task) return
    setCancelling(true)
    try {
      const updated = await cancelTask(task.project_id, task.id)
      onTaskUpdate?.(updated)
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : 'Cancel failed')
    } finally {
      setCancelling(false)
    }
  }

  const isFailed = task?.status === 'failed' || task?.status === 'cancelled'
  const isInProgress = task?.status === 'in-progress'

  // For in-progress tasks show live chunks; for completed/failed show the stored output
  const displayOutput = isInProgress ? (liveOutput ?? '') : (task?.output ?? '')

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full md:w-[520px] bg-neutral-900 border-l border-neutral-800 shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-800 flex-none h-16">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-neutral-100 truncate">{task?.title ?? 'Task Output'}</h2>
            {task && (
              <p className="text-xs text-neutral-500 truncate">
                {task.role ?? 'agent'} · <span className={isFailed ? 'text-red-400' : isInProgress ? 'text-primary-400' : ''}>{task.status}</span>
              </p>
            )}
          </div>
          {isInProgress && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-800 hover:bg-red-900 text-neutral-300 hover:text-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-none"
            >
              <svg className={`w-3 h-3 ${cancelling ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {cancelling
                  ? <><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></>
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                }
              </svg>
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
          {isFailed && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-red-900 hover:bg-red-800 text-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-none"
            >
              <svg className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {retrying ? 'Retrying…' : 'Retry'}
            </button>
          )}
          <button
            ref={closeRef}
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors flex-none"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4">
          {retryError && (
            <div className="text-xs text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
              {retryError}
            </div>
          )}

          {isInProgress ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Live Output</span>
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
              {/* Max 20 lines (~320px) visible; scrollable to see all; auto-scrolls to bottom */}
              <div
                ref={liveScrollRef}
                className="bg-neutral-950 rounded-lg p-4 font-mono text-xs text-neutral-300 whitespace-pre-wrap break-words overflow-y-auto"
                style={{ maxHeight: '20lh', minHeight: '3rem' }}
              >
                {displayOutput || <span className="text-neutral-600 italic">Waiting for output…</span>}
              </div>
            </div>
          ) : displayOutput ? (
            <div className={`rounded-lg p-4 font-mono text-xs whitespace-pre-wrap break-words overflow-y-auto ${isFailed ? 'bg-red-950/40 border border-red-900 text-red-300' : 'bg-neutral-950 text-neutral-300'}`}>
              {displayOutput}
            </div>
          ) : (
            <p className="text-sm text-neutral-500 italic">No output yet.</p>
          )}

          {messages.length > 0 && (
            <>
              <hr className="border-neutral-800" />
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Message History</p>
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className="bg-primary-950 border border-primary-900 rounded-lg rounded-tl-none px-3 py-2 max-w-[90%]">
                    <p className="text-xs text-neutral-600 mb-1">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                    <p className="text-sm text-neutral-200">{msg.content}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {task && (
            <div className="pt-2 border-t border-neutral-800">
              <p className="text-xs text-neutral-600 font-mono break-all">ID: {task.id}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
