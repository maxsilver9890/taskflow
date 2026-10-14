"use client";

import { FolderKanban, Plus, PlusCircle } from "lucide-react";
import { useState } from "react";

import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Pagination } from "@/components/ui/Pagination";
import { useDeleteProject, useProjects } from "@/hooks/use-projects";
import type { Project } from "@/lib/api/types";
import { errorMessage } from "@/lib/api/errors";
import { toast } from "sonner";

const LIMIT = 12;

export default function ProjectsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch, isFetching } = useProjects(page, LIMIT);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const deleteProject = useDeleteProject();

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(project: Project) {
    setEditing(project);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteProject.mutateAsync(deleting.id);
      toast.success(`“${deleting.name}” deleted`);
      setDeleting(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div>
      <div className="tf-projects-page space-y-6 p-4 md:p-6">
        <section className="tf-project-index-head" aria-labelledby="projects-heading">
          <div>
            <h1 id="projects-heading">PROJECTS</h1>
            <p>{isLoading ? "Loading workspace projects…" : isError ? "PROJECTS UNAVAILABLE" : `TOTAL PROJECTS: ${data?.total ?? 0}`}</p>
          </div>
          <Button size="md" onClick={openCreate}>
            <Plus className="size-4" /> New project
          </Button>
        </section>

        {isLoading ? (
          <div className="tf-project-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data && data.data.length > 0 ? (
          <>
            <div className={`tf-project-grid ${data.data.length === 3 ? "is-three-projects" : ""}`}>
              {data.data.map((project, index) => (
                <ProjectCard key={project.id} project={project} featured={index === 0} dark={index === 1} onEdit={openEdit} onDelete={setDeleting} />
              ))}
              <button type="button" className="tf-add-project-tile" onClick={openCreate}>
                <PlusCircle className="size-10" />
                <span>Add another project</span>
              </button>
            </div>
            <div className="tf-project-pagination">
              <Pagination page={page} limit={LIMIT} total={data.total} onPageChange={setPage} />
            </div>
            {isFetching && <p className="text-right text-xs font-bold uppercase tracking-wider text-ink-3">Updating…</p>}
          </>
        ) : (
          <EmptyState
            icon={<FolderKanban className="size-5" />}
            title="No projects yet"
            description="Create your first project to start organizing tasks."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" /> New project
              </Button>
            }
          />
        )}
      </div>

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} project={editing} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete project?"
        description={`This permanently deletes “${deleting?.name}” and all of its tasks. This cannot be undone.`}
        confirmLabel="Delete project"
        destructive
        loading={deleteProject.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
