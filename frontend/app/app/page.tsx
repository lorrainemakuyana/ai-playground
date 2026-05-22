"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getProjects, logout } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { ProjectSummary } from "@/types";
import NewProjectForm from "./_components/NewProjectForm";
import ActiveProjectCard from "./_components/ActiveProjectCard";
import ArchivedProjectCard from "./_components/ArchivedProjectCard";
import RevokedProjectCard from "./_components/RevokedProjectCard";

function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 my-8">
      <div className="flex-1 h-px bg-neutral-800" />
      {children}
      <div className="flex-1 h-px bg-neutral-800" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-5">
        <svg
          className="w-8 h-8 text-neutral-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-neutral-300 mb-2">
        No projects yet
      </h3>
      <p className="text-sm text-neutral-500 max-w-sm">
        Create your first project and take your ideas to the world.
      </p>
    </div>
  );
}

export default function AppHomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [fetchError, setFetchError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getProjects();
      setProjects(data.projects);
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Failed to load projects",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      /* clear token regardless */
    }
    clearToken();
    router.push("/auth");
  }

  function handleArchived(projectId: string) {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, archived_at: new Date().toISOString() }
          : p,
      ),
    );
  }

  function handleUnarchived(projectId: string) {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, archived_at: null } : p)),
    );
  }

  function handleDeleted(projectId: string) {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  }

  function handleRemovedShare(projectId: string) {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  }

  const activeProjects = projects.filter((p) => p.is_owner && !p.archived_at);
  const activeShared = projects.filter(
    (p) => !p.is_owner && p.share_status === "active",
  );
  const archivedOwn = projects.filter((p) => p.is_owner && !!p.archived_at);
  const revokedShared = projects.filter(
    (p) => !p.is_owner && p.share_status === "revoked",
  );

  const allActive = [...activeProjects, ...activeShared];
  const totalActive = allActive.length;

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center flex-none">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="text-base font-bold text-neutral-100 tracking-tight">
              Orchestrator
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/app/agents"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Manage Agents
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-neutral-100 mb-1">
              Projects
            </h1>
            <p className="text-sm text-neutral-500">
              {totalActive > 0
                ? `${totalActive} active project${totalActive === 1 ? "" : "s"} — each managed by an autonomous AI engineering team.`
                : "Your autonomous AI engineering team is ready. Create a project to get started."}
            </p>
          </div>
          <NewProjectForm />
        </div>

        {fetchError && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-4 py-3 mb-6">
            <svg
              className="w-4 h-4 flex-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {fetchError} — the backend may be offline.
          </div>
        )}

        {/* Active projects */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allActive.length === 0 && !fetchError ? (
            <EmptyState />
          ) : (
            allActive.map((project) => (
              <ActiveProjectCard
                key={project.id}
                project={project}
                onArchived={handleArchived}
              />
            ))
          )}
        </div>

        {/* Archived section */}
        {archivedOwn.length > 0 && (
          <>
            <SectionDivider>
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors whitespace-nowrap"
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${showArchived ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                {showArchived ? "Hide" : "Show"} archived projects
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-neutral-700 text-neutral-400 text-xs">
                  {archivedOwn.length}
                </span>
              </button>
            </SectionDivider>

            {showArchived && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {archivedOwn.map((project) => (
                  <ArchivedProjectCard
                    key={project.id}
                    project={project}
                    onDeleted={handleDeleted}
                    onUnarchived={handleUnarchived}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Revoked section */}
        {revokedShared.length > 0 && (
          <>
            <SectionDivider>
              <span className="flex items-center gap-2 px-3 py-1 text-xs text-neutral-600 whitespace-nowrap">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
                Projects you no longer have access to
              </span>
            </SectionDivider>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {revokedShared.map((project) => (
                <RevokedProjectCard
                  key={project.id}
                  project={project}
                  onRemoved={handleRemovedShare}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
