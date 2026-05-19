import Link from 'next/link'
import { getProjects } from '@/lib/api'
import { PHASE_LABELS } from '@/lib/constants'
import type { ProjectSummary } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import NewProjectForm from './_components/NewProjectForm'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function DownloadLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      download
      className="flex items-center gap-1 px-2 py-1 rounded text-xs text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
    >
      <svg className="w-3 h-3 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {label}
    </a>
  )
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const base = `${API_BASE}/projects/${project.id}`
  const isDone = project.status === 'done'

  return (
    <div className="group bg-neutral-900 border border-neutral-800 rounded-xl hover:border-neutral-700 hover:bg-neutral-850 transition-colors duration-150 flex flex-col min-h-[200px]">
      <Link href={`/projects/${project.id}`} className="block p-6 flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-base font-semibold text-neutral-100 group-hover:text-white transition-colors leading-tight">
            {project.name}
          </h3>
          <StatusBadge status={project.status} />
        </div>

        <div className="flex items-center gap-1.5 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
          <span className="text-xs text-neutral-400 font-medium">
            {PHASE_LABELS[project.current_phase] ?? project.current_phase}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {project.agent_count} agents
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {project.task_count} tasks
          </span>
          <span className="ml-auto">
            {new Date(project.created_at).toLocaleDateString()}
          </span>
        </div>
      </Link>

      {/* Download strip */}
      <div className="px-4 py-2.5 border-t border-neutral-800 flex items-center gap-1 flex-wrap">
        <span className="text-xs text-neutral-600 mr-1">Download:</span>
        <DownloadLink href={`${base}/docs/requirements`} label="Requirements" />
        <DownloadLink href={`${base}/docs/architecture`} label="Architecture" />
        <DownloadLink href={`${base}/docs/design`} label="Design" />
        <Link
          href={`/projects/${project.id}/preview`}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
        >
          <svg className="w-3 h-3 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Preview
        </Link>
        {isDone && (
          <a
            href={`${base}/download`}
            download
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-primary-300 bg-primary-950 hover:bg-primary-900 border border-primary-900 transition-colors"
          >
            <svg className="w-3 h-3 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            All files (.zip)
          </a>
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-neutral-300 mb-2">No projects yet</h3>
      <p className="text-sm text-neutral-500 max-w-sm">
        Create your first project and let the AI engineering team take it from idea to production.
      </p>
    </div>
  )
}

export default async function HomePage() {
  let projects: ProjectSummary[] = []
  let fetchError = ''

  try {
    const data = await getProjects()
    projects = data.projects
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Failed to load projects'
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center flex-none">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-base font-bold text-neutral-100 tracking-tight">Orchestrator</span>
          </div>
          <Link
            href="/agents"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Manage Team
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-neutral-100 mb-1">Projects</h1>
            <p className="text-sm text-neutral-500">
              {projects.length > 0
                ? `${projects.length} project${projects.length === 1 ? '' : 's'} — each managed by an autonomous AI engineering team.`
                : 'Your autonomous AI engineering team is ready. Create a project to get started.'}
            </p>
          </div>
          <NewProjectForm />
        </div>

        {fetchError && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-4 py-3 mb-6">
            <svg className="w-4 h-4 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {fetchError} — the backend may be offline.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.length === 0 && !fetchError ? (
            <EmptyState />
          ) : (
            projects.map(project => <ProjectCard key={project.id} project={project} />)
          )}
        </div>
      </main>
    </div>
  )
}
