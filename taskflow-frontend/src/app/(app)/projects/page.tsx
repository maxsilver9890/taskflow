"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
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
import { FolderKanban } from "lucide-react";
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
      <PageHeader
        title="Projects"
        description="Every project in your organization."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" /> New project
          </Button>
        }
      />

      <div className="p-4 md:p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : data && data.data.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.data.map((project) => (
                <ProjectCard key={project.id} project={project} onEdit={openEdit} onDelete={setDeleting} />
              ))}
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
              <Pagination page={page} limit={LIMIT} total={data.total} onPageChange={setPage} />
            </div>
            {isFetching && <p className="mt-2 text-center text-[12px] text-ink-3">Updating…</p>}
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
