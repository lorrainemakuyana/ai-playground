'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { getProject, dispatchNextTask, sendDirective, cancelTask } from '@/lib/api'
import type { Project, Agent, Task, AgentMessage, SDLCPhase, AgentStatus } from '@/types'
import { useProjectStream } from '@/hooks/useProjectStream'
import PhaseTracker from '@/components/PhaseTracker'
import AgentCard from '@/components/AgentCard'
import TaskFeed from '@/components/TaskFeed'
import AgentOutputDrawer from '@/components/AgentOutputDrawer'
import ShareModal from './_components/ShareModal'
import Spinner from '@/components/Spinner'
import StatusBadge from '@/components/StatusBadge'

export default function ProjectDashboardPage() {
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [currentPhase, setCurrentPhase] = useState<SDLCPhase>('discovery')
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  const [resuming, setResuming] = useState(false)
  const [stoppingAgentId, setStoppingAgentId] = useState<string | null>(null)
  const [taskLiveOutputs, setTaskLiveOutputs] = useState<Record<string, string>>({})
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const data = await getProject(projectId)
        setProject(data)
        setAgents(data.agents)
        setTasks(data.tasks)
        setMessages(data.messages)
        setCurrentPhase(data.current_phase)
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load project')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [projectId])

  const handleTaskUpdate = useCallback((task: Task) => {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === task.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = task
        return next
      }
      return [task, ...prev]
    })
  }, [])

  const handleAgentMessage = useCallback((message: AgentMessage) => {
    setMessages(prev => [message, ...prev])
  }, [])

  const handleAgentStatus = useCallback((agentId: string, status: AgentStatus) => {
    setAgents(prev =>
      prev.map(a => a.id === agentId ? { ...a, status } : a)
    )
  }, [])

  const stopRef = useRef<(() => void) | null>(null)

  const handlePhaseChange = useCallback((newPhase: SDLCPhase) => {
    setCurrentPhase(newPhase)
    if (newPhase === 'done') stopRef.current?.()
  }, [])

  const handleTaskOutputChunk = useCallback((taskId: string, chunk: string, reset: boolean) => {
    setTaskLiveOutputs(prev => ({
      ...prev,
      [taskId]: reset ? chunk : (prev[taskId] ?? '') + chunk,
    }))
  }, [])

  const handleError = useCallback((message: string) => {
    toast.error(message, { duration: Infinity })
  }, [])

  const { connectionStatus, reconnect, stop } = useProjectStream({
    projectId,
    onTaskUpdate: handleTaskUpdate,
    onAgentMessage: handleAgentMessage,
    onAgentStatus: handleAgentStatus,
    onPhaseChange: handlePhaseChange,
    onTaskOutputChunk: handleTaskOutputChunk,
    onError: handleError,
  })

  useEffect(() => { stopRef.current = stop }, [stop])

  const isConnected = connectionStatus === 'connected'

  const hasPendingTasks = tasks.some(t => t.status === 'pending' || t.status === 'in-progress')
  const allAgentsIdle = agents.length > 0 && agents.every(a => a.status === 'idle')
  const showResume = hasPendingTasks && allAgentsIdle && project?.status !== 'done'

  async function handleResume() {
    setResuming(true)
    try {
      const task = await dispatchNextTask(projectId)
      handleTaskUpdate(task)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to dispatch next task')
    } finally {
      setResuming(false)
    }
  }

  async function handleStopAgent(agentId: string) {
    const inProgressTask = tasks.find(t => t.assigned_agent_id === agentId && t.status === 'in-progress')
    if (!inProgressTask) return
    setStoppingAgentId(agentId)
    try {
      const cancelled = await cancelTask(projectId, inProgressTask.id)
      handleTaskUpdate(cancelled)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to stop agent')
    } finally {
      setStoppingAgentId(null)
    }
  }

  const tasksByAgentId = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      if (task.assigned_agent_id) {
        const arr = map.get(task.assigned_agent_id) ?? []
        arr.push(task)
        map.set(task.assigned_agent_id, arr)
      }
    }
    return map
  }, [tasks])

  function openTaskDrawer(taskId: string) {
    setSelectedTaskId(taskId)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
  }

  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null
  const drawerMessages = selectedTask?.assigned_agent_id
    ? messages.filter(m => m.from_agent_id === selectedTask.assigned_agent_id)
    : []

  function getAgentLatestOutput(agentId: string): string | undefined {
    return tasksByAgentId.get(agentId)?.find(t => t.output != null)?.output ?? undefined
  }

  function getAgentCurrentTask(agentId: string): string | undefined {
    return tasksByAgentId.get(agentId)?.find(t => t.status === 'in-progress')?.title
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner />
          <p className="text-sm text-neutral-400">Loading project...</p>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 text-sm font-medium">{fetchError}</div>
        <Link href="/app" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
          ← Back to Projects
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 sm:px-6 h-14 border-b border-neutral-800 bg-neutral-900 flex-none">
        <Link
          href="/app"
          className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Projects
        </Link>

        <div className="flex-1 flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-semibold text-neutral-100 truncate">
            {project?.name ?? 'Project'}
          </h1>
          {project && <StatusBadge status={project.status} />}
        </div>

        {tasks.some(t => t.status === 'done' && t.output) && (
          <a
            href={`/api/projects/${projectId}/download`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-950 hover:bg-primary-900 border border-primary-800 text-primary-300 transition-colors flex-none"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download (.zip)
          </a>
        )}

        <Link
          href={`/app/projects/${projectId}/preview`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors flex-none"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Preview
        </Link>

        {project?.is_owner && (
          <button
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors flex-none"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
        )}

        {showResume && (
          <button
            onClick={handleResume}
            disabled={resuming}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex-none"
          >
            {resuming ? (
              <>
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Resuming…
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Resume
              </>
            )}
          </button>
        )}

        {project?.is_owner && (
          <Link
            href={`/app/projects/${projectId}/agents`}
            className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors flex items-center gap-1 flex-none"
          >
            Manage Team
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>

      <PhaseTracker currentPhase={currentPhase} />

      {connectionStatus === 'failed' && (
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-red-950 border-b border-red-900 text-sm text-red-300">
          <span>Live connection lost. Updates paused.</span>
          <button
            onClick={reconnect}
            className="text-xs font-medium text-red-200 hover:text-white underline underline-offset-2 transition-colors"
          >
            Retry connection
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        <div className="w-full md:w-[340px] flex-none border-b md:border-b-0 md:border-r border-neutral-800 overflow-y-auto">
          <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-200">Team</span>
            <span className="text-xs text-neutral-500">{agents.length} agents</span>
          </div>
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <p className="text-sm text-neutral-400 font-medium">No agents yet</p>
              <p className="text-xs text-neutral-600 mt-1">Agents will appear once the project starts</p>
              <Link
                href={`/app/projects/${projectId}/agents`}
                className="mt-4 text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                Manage Team →
              </Link>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {agents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  latestOutput={getAgentLatestOutput(agent.id)}
                  currentTask={getAgentCurrentTask(agent.id)}
                  isSelected={selectedAgentId === agent.id}
                  onClick={(agentId) => {
                    setSelectedAgentId(prev => prev === agentId ? null : agentId)
                  }}
                  onStop={handleStopAgent}
                  stopping={stoppingAgentId === agent.id}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col min-h-[400px] md:min-h-0">
          <TaskFeed
            tasks={selectedAgentId ? tasks.filter(t => t.assigned_agent_id === selectedAgentId) : tasks}
            filterLabel={selectedAgentId ? (agents.find(a => a.id === selectedAgentId)?.specialization ?? null) : null}
            onClearFilter={() => setSelectedAgentId(null)}
            onTaskClick={openTaskDrawer}
            isConnected={isConnected}
            onSendDirective={async (content) => {
              const task = await sendDirective(projectId, content)
              handleTaskUpdate(task)
            }}
          />
        </div>
      </div>

      <AgentOutputDrawer
        isOpen={drawerOpen}
        task={selectedTask}
        messages={drawerMessages}
        liveOutput={selectedTask ? taskLiveOutputs[selectedTask.id] : undefined}
        onClose={closeDrawer}
        onTaskUpdate={handleTaskUpdate}
      />

      {shareOpen && project?.is_owner && (
        <ShareModal projectId={projectId} onClose={() => setShareOpen(false)} />
      )}
    </div>
  )
}
