"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Input";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { Project } from "@/lib/api/types";
import { useCreateProject, useUpdateProject } from "@/hooks/use-projects";

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  onSaved?: (project: Project) => void;
}) {
  const isEdit = !!project;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const create = useCreateProject();
  const update = useUpdateProject(project?.id ?? "");
  const pending = create.isPending || update.isPending;

  // Re-sync local form state from the project each time the dialog opens.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setFieldErrors({});
    }
  }, [open, project]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function submit() {
    setFieldErrors({});
    try {
      const trimmedDescription = description.trim();
      if (isEdit && project) {
        const saved = await update.mutateAsync({
          name: name.trim(),
          description: trimmedDescription === "" ? null : trimmedDescription,
        });
        toast.success("Project updated");
        onSaved?.(saved);
      } else {
        const saved = await create.mutateAsync({
          name: name.trim(),
          ...(trimmedDescription && { description: trimmedDescription }),
        });
        toast.success("Project created");
        onSaved?.(saved);
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      } else {
        toast.error(errorMessage(err));
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit project" : "New project"}
      description={isEdit ? "Update the project name or description." : "Projects group related tasks together."}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} loading={pending} disabled={!name.trim()}>
            {isEdit ? "Save changes" : "Create project"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="project-name">Name</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Customer Portal Refresh"
            maxLength={255}
            autoFocus
          />
          <FieldError>{fieldErrors.name?.[0]}</FieldError>
        </div>
        <div>
          <Label htmlFor="project-description">Description</Label>
          <Textarea
            id="project-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project about?"
            maxLength={5000}
          />
          <FieldError>{fieldErrors.description?.[0]}</FieldError>
        </div>
      </div>
    </Dialog>
  );
}
