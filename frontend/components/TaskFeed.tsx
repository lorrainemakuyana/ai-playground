'use client'

import { useState, useRef } from 'react'
import type { Task } from '@/types'

interface TaskFeedProps {
  tasks: Task[]
  onTaskClick: (taskId: string) => void
  isConnected: boolean
  onSendDirective: (content: string) => Promise<void>
  filterLabel?: string | null
  onClearFilter?: () => void
}

export default function TaskFeed({ tasks, onTaskClick, isConnected, onSendDirective, filterLabel, onClearFilter }: TaskFeedProps) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSend() {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    try {
      await onSendDirective(content)
      setInput('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 flex-none">
        <span className="text-sm font-semibold text-neutral-200">Tasks</span>
        {filterLabel && (
          <button
            onClick={onClearFilter}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-900 border border-primary-700 text-xs text-primary-300 hover:bg-primary-800 transition-colors"
          >
            {filterLabel}
            <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          <span className={`text-xs ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            {isConnected ? 'Live' : 'Reconnecting...'}
          </span>
        </div>
      </div>

      {/* Task list */}
      <div className="overflow-y-auto flex-1">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-neutral-400">Waiting for tasks...</p>
            <p className="text-xs text-neutral-600 mt-1">Agents will appear here once work begins</p>
          </div>
        ) : (
          [...tasks].reverse().map((task) => (
            <button
              key={task.id}
              onClick={() => onTaskClick(task.id)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-neutral-800 last:border-b-0 hover:bg-neutral-850 transition-colors duration-100 text-left animate-fadeSlideDown"
            >
              <TaskStatusIcon status={task.status} />
              <span className="flex-1 text-sm text-neutral-200 truncate">{task.title}</span>
              <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 whitespace-nowrap">
                {task.role ?? 'unassigned'}
              </span>
              <span className="text-xs text-neutral-500 whitespace-nowrap">
                {new Date(task.created_at).toLocaleTimeString()}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Directive input */}
      <div className="border-t border-neutral-800 p-3 flex-none bg-neutral-900">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-primary-500 leading-snug"
            placeholder="Direct the team — add requirements, update scope, ask the tech lead anything… (Enter to send)"
            rows={1}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex-none p-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
            title="Send directive (Enter)"
          >
            {sending ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskStatusIcon({ status }: { status: Task['status'] }) {
  if (status === 'done') return (
    <svg className="w-5 h-5 text-green-400 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
  if (status === 'failed') return (
    <svg className="w-5 h-5 text-red-400 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
  if (status === 'cancelled') return (
    <svg className="w-5 h-5 text-neutral-500 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  )
  if (status === 'in-progress') return (
    <svg className="w-5 h-5 text-primary-400 flex-none animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
  return (
    <svg className="w-5 h-5 text-amber-500 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  )
}
