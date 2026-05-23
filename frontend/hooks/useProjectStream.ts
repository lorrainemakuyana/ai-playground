'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import type { SSEEvent, Task, AgentMessage, SDLCPhase, AgentStatus } from '@/types'

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'failed'

interface UseProjectStreamOptions {
  projectId: string
  onTaskUpdate: (task: Task) => void
  onAgentMessage: (message: AgentMessage) => void
  onAgentStatus: (agentId: string, status: AgentStatus) => void
  onPhaseChange: (newPhase: SDLCPhase) => void
  onTaskOutputChunk?: (taskId: string, chunk: string, reset: boolean) => void
  onError?: (message: string) => void
}

export function useProjectStream({
  projectId,
  onTaskUpdate,
  onAgentMessage,
  onAgentStatus,
  onPhaseChange,
  onTaskOutputChunk,
  onError,
}: UseProjectStreamOptions) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const esRef = useRef<EventSource | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptsRef = useRef(0)
  const MAX_ATTEMPTS = 5

  const connect = useCallback(() => {
    esRef.current?.close()
    setConnectionStatus(attemptsRef.current === 0 ? 'connecting' : 'reconnecting')

    // Route through the Next.js /api proxy (same-origin) so the auth cookie is
    // included automatically. EventSource has no header API, so direct cross-origin
    // requests to the backend would never carry the token.
    const es = new EventSource(`/api/projects/${projectId}/stream`)
    esRef.current = es

    es.onopen = () => {
      setConnectionStatus('connected')
      attemptsRef.current = 0
    }

    es.onmessage = (event: MessageEvent) => {
      try {
        const sseEvent: SSEEvent = JSON.parse(event.data as string)
        switch (sseEvent.type) {
          case 'task_update':
            onTaskUpdate(sseEvent.payload)
            break
          case 'agent_message':
            onAgentMessage(sseEvent.payload)
            break
          case 'agent_status':
            onAgentStatus(sseEvent.payload.agent_id, sseEvent.payload.status)
            break
          case 'phase_change':
            onPhaseChange(sseEvent.payload.new_phase)
            break
          case 'task_output_chunk':
            onTaskOutputChunk?.(sseEvent.payload.task_id, sseEvent.payload.chunk, sseEvent.payload.reset)
            break
          case 'error':
            onError?.(sseEvent.payload.message)
            break
          case 'heartbeat':
            break
        }
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      es.close()
      esRef.current = null
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        setConnectionStatus('failed')
        return
      }
      const delay = 1000 * Math.pow(2, attemptsRef.current)
      attemptsRef.current += 1
      setConnectionStatus('reconnecting')
      reconnectRef.current = setTimeout(connect, delay)
    }
  }, [projectId, onTaskUpdate, onAgentMessage, onAgentStatus, onPhaseChange, onTaskOutputChunk, onError])

  const stop = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
    if (reconnectRef.current) clearTimeout(reconnectRef.current)
    attemptsRef.current = MAX_ATTEMPTS // prevent future reconnects
    setConnectionStatus('failed')
  }, [])

  const reconnect = useCallback(() => {
    attemptsRef.current = 0
    connect()
  }, [connect])

  useEffect(() => {
    connect()
    return () => {
      esRef.current?.close()
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [connect])

  return { connectionStatus, reconnect, stop }
}
