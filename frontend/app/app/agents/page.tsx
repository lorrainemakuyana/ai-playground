'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  getAgentTemplates, createAgentTemplate, updateAgentTemplate, archiveAgentTemplate,
  getMasterPrompts,
} from '@/lib/api'
import { agentAvatarClass, getInitials } from '@/lib/utils'
import type { AgentTemplate, AgentRole, MasterPrompts } from '@/types'
import Spinner from '@/components/Spinner'

const MODELS = [
  { value: 'claude-sonnet-4-6',        label: 'Sonnet 4.6' },
  { value: 'claude-opus-4-7',           label: 'Opus 4.7' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
]

const ROLES: { value: AgentRole; label: string }[] = [
  { value: 'tech-lead',  label: 'Tech Lead' },
  { value: 'engineer-1', label: 'Senior Engineer (1)' },
  { value: 'engineer-2', label: 'Senior Engineer (2)' },
  { value: 'qa',         label: 'QA Engineer' },
  { value: 'sre',        label: 'SRE' },
  { value: 'custom',     label: 'Custom' },
]

interface EditState {
  specialization: string
  model_name: string
  system_prompt: string
}

interface NewAgentState {
  role: AgentRole
  customTitle: string
  model_name: string
  system_prompt: string
}

export default function DefaultTeamPage() {
  const [templates, setTemplates] = useState<AgentTemplate[]>([])
  const [masterPrompts, setMasterPrompts] = useState<MasterPrompts>({})
  const [openPrompts, setOpenPrompts] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ specialization: '', model_name: '', system_prompt: '' })
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newAgent, setNewAgent] = useState<NewAgentState>({
    role: 'custom', customTitle: '', model_name: 'claude-sonnet-4-6', system_prompt: '',
  })
  const addFormRef = useRef<HTMLDivElement>(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    try {
      const [data, prompts] = await Promise.all([getAgentTemplates(), getMasterPrompts()])
      setTemplates(data)
      setMasterPrompts(prompts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  function togglePrompt(id: string) {
    setOpenPrompts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => { void load() }, [load])

  function startEdit(tmpl: AgentTemplate) {
    setEditingId(tmpl.id)
    setEditState({ specialization: tmpl.specialization, model_name: tmpl.model_name, system_prompt: tmpl.system_prompt ?? '' })
  }

  async function saveEdit(id: string) {
    setSaving(true)
    try {
      const updated = await updateAgentTemplate(id, {
        ...editState,
        system_prompt: editState.system_prompt.trim() || null,
      })
      setTemplates(prev => prev.map(t => t.id === id ? updated : t))
      setEditingId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(id: string) {
    try {
      await archiveAgentTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Archive failed')
    }
  }

  async function handleAdd() {
    const isCustom = newAgent.role === 'custom'
    const specialization = isCustom
      ? newAgent.customTitle.trim()
      : (ROLES.find(r => r.value === newAgent.role)?.label ?? newAgent.role)

    setAdding(true)
    try {
      const created = await createAgentTemplate({
        role: newAgent.role,
        specialization,
        model_name: newAgent.model_name,
        system_prompt: newAgent.system_prompt.trim() || null,
      })
      setTemplates(prev => [...prev, created])
      setShowAdd(false)
      setNewAgent({ role: 'custom', customTitle: '', model_name: 'claude-sonnet-4-6', system_prompt: '' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Add failed')
    } finally {
      setAdding(false)
    }
  }

  const canAdd = newAgent.role !== 'custom' || newAgent.customTitle.trim().length >= 2

  if (loading) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center"><Spinner /></div>
  )

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link href="/app" className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors flex items-center gap-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Projects
          </Link>
          <span className="text-neutral-700">/</span>
          <span className="text-sm font-semibold text-neutral-100 flex-1">Manage Agents</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-neutral-500">
            These agents are automatically added to every new project.
          </p>
          <button
            onClick={() => {
              setShowAdd(true)
              setTimeout(() => addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Agent
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{error}</div>
        )}

        {templates.filter(t => t.is_active).map(tmpl => {
          const isTechLead = tmpl.role === 'tech-lead'
          const isEditing = editingId === tmpl.id

          return (
            <div key={tmpl.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              {isEditing ? (
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-base font-bold uppercase select-none flex-none ${agentAvatarClass(tmpl.role)}`}>
                    {getInitials(tmpl.role)}
                  </div>
                  <div className="flex-1 flex flex-col gap-3">
                    <div>
                      <p className="text-sm font-semibold text-neutral-100">{tmpl.specialization}</p>
                      <p className="text-xs text-neutral-500">{ROLES.find(r => r.value === tmpl.role)?.label ?? tmpl.role}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-neutral-400">Model</label>
                      <select
                        className="w-1/2 bg-neutral-950 border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        value={editState.model_name}
                        onChange={e => setEditState(s => ({ ...s, model_name: e.target.value }))}
                      >
                        {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-neutral-400">System Prompt <span className="text-neutral-600 font-normal">(optional)</span></label>
                      <textarea
                        className="bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-y min-h-[80px] leading-snug font-mono"
                        placeholder="Define this agent's persona, expertise, and behavior…"
                        rows={4}
                        value={editState.system_prompt}
                        onChange={e => setEditState(s => ({ ...s, system_prompt: e.target.value }))}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingId(null)}
                        className="px-4 py-1.5 text-xs font-medium rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300">
                        Cancel
                      </button>
                      <button onClick={() => saveEdit(tmpl.id)} disabled={saving}
                        className="px-4 py-1.5 text-xs font-medium rounded-md bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-base font-bold uppercase select-none flex-none ${agentAvatarClass(tmpl.role)}`}>
                      {getInitials(tmpl.role)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-100">{tmpl.specialization}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {ROLES.find(r => r.value === tmpl.role)?.label ?? tmpl.role}
                        {' · '}
                        <span className="font-mono">{MODELS.find(m => m.value === tmpl.model_name)?.label ?? tmpl.model_name}</span>
                      </p>
                      {tmpl.system_prompt && (
                        <p className="text-xs text-neutral-600 mt-1.5 font-mono line-clamp-2">{tmpl.system_prompt}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-none">
                      <button onClick={() => startEdit(tmpl)}
                        className="p-2 rounded-lg text-neutral-500 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
                        title="Edit">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {!isTechLead && (
                        <button onClick={() => handleArchive(tmpl.id)}
                          className="p-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                          title="Archive">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Base prompt disclosure */}
                  <div className="border-t border-neutral-800 pt-2">
                    <button
                      onClick={() => togglePrompt(tmpl.id)}
                      className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors w-full text-left"
                    >
                      <svg
                        className={`w-3.5 h-3.5 transition-transform duration-150 ${openPrompts.has(tmpl.id) ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Base prompt
                    </button>

                    {openPrompts.has(tmpl.id) && (
                      <div className="mt-2">
                        {masterPrompts[tmpl.role] ? (
                          <pre className="text-xs text-neutral-400 font-mono bg-neutral-950 border border-neutral-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                            {masterPrompts[tmpl.role]}
                          </pre>
                        ) : (
                          <p className="text-xs text-neutral-600 italic">No base prompt for this role.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {showAdd && (
          <div ref={addFormRef} className="bg-neutral-900 border border-primary-800 rounded-xl p-5 space-y-3">
            <p className="text-sm font-semibold text-neutral-200">New default agent</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-neutral-400">Role</label>
                <select
                  className="bg-neutral-950 border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={newAgent.role}
                  onChange={e => setNewAgent(s => ({ ...s, role: e.target.value as AgentRole }))}
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {newAgent.role === 'custom' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-neutral-400">Custom role title</label>
                  <input
                    className="bg-neutral-950 border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="e.g. DevOps Engineer"
                    value={newAgent.customTitle}
                    onChange={e => setNewAgent(s => ({ ...s, customTitle: e.target.value }))}
                    maxLength={100}
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-400">Model</label>
              <select
                className="w-1/2 bg-neutral-950 border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                value={newAgent.model_name}
                onChange={e => setNewAgent(s => ({ ...s, model_name: e.target.value }))}
              >
                {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-400">System Prompt <span className="text-neutral-600 font-normal">(optional)</span></label>
              <textarea
                className="bg-neutral-950 border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-y min-h-[72px] leading-snug font-mono"
                placeholder="Define this agent's persona, expertise, and behavior…"
                rows={3}
                value={newAgent.system_prompt}
                onChange={e => setNewAgent(s => ({ ...s, system_prompt: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300">
                Cancel
              </button>
              <button onClick={handleAdd} disabled={adding || !canAdd}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-40">
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
