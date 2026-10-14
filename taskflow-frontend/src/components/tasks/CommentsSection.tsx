"use client";

import { MessageSquare, Pencil, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { Textarea } from "@/components/ui/Input";
import { useCreateComment, useComments, useDeleteComment, useUpdateComment } from "@/hooks/use-comments";
import { errorMessage } from "@/lib/api/errors";
import type { Comment } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatRelative } from "@/lib/utils";

export function CommentsSection({ taskId }: { taskId: string }) {
  const { user, isAdmin } = useAuth();
  const { data, isLoading, isError, error, refetch } = useComments(taskId);
  const createComment = useCreateComment(taskId);
  const updateComment = useUpdateComment(taskId);
  const deleteComment = useDeleteComment(taskId);

  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function submitNew(e: FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    try {
      await createComment.mutateAsync(content);
      setDraft("");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  function startEdit(comment: Comment) {
    setEditingId(comment.id);
    setEditDraft(comment.content);
  }

  async function submitEdit(e: FormEvent, commentId: string) {
    e.preventDefault();
    const content = editDraft.trim();
    if (!content) return;
    try {
      await updateComment.mutateAsync({ commentId, content });
      setEditingId(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    try {
      await deleteComment.mutateAsync(deletingId);
      toast.success("Comment deleted");
      setDeletingId(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const comments = data?.data ?? [];

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
        <MessageSquare className="size-3.5" />
        Comments{data ? ` (${data.total})` : ""}
      </h2>

      <form onSubmit={submitNew} className="mb-4 space-y-2">
        <label htmlFor="new-comment" className="sr-only">
          Add a comment
        </label>
        <Textarea
          id="new-comment"
          rows={2}
          placeholder="Write a comment…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={5000}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={createComment.isPending} disabled={!draft.trim()}>
            Comment
          </Button>
        </div>
      </form>

      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-ink-3">No comments yet. Be the first to add one.</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => {
            const isDeleted = Boolean(comment.deletedAt);
            const canModify = !isDeleted && comment.authorId === user?.id;
            const canDelete = !isDeleted && (canModify || (isAdmin && comment.authorRole === "MEMBER"));
            const isEditing = !isDeleted && editingId === comment.id;
            return (
              <li key={comment.id} className="flex gap-2.5">
                <Avatar name={comment.author.name} size="sm" className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[13px] font-medium text-ink">{comment.author.name}</span>
                    <span className="shrink-0 text-[11.5px] text-ink-3" title={comment.createdAt}>
                      {formatRelative(comment.createdAt)}
                      {comment.updatedAt !== comment.createdAt && " (edited)"}
                    </span>
                  </div>

                  {isDeleted ? (
                    <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] italic leading-relaxed text-ink-3">
                      Message deleted by {comment.deletedByName ?? "a user"}
                    </p>
                  ) : isEditing ? (
                    <form onSubmit={(e) => submitEdit(e, comment.id)} className="mt-1.5 space-y-2">
                      <Textarea
                        rows={2}
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        maxLength={5000}
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          <X className="size-3.5" /> Cancel
                        </Button>
                        <Button type="submit" size="sm" loading={updateComment.isPending} disabled={!editDraft.trim()}>
                          Save
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{comment.content}</p>
                      {(canModify || canDelete) && (
                        <div className="mt-1 flex gap-3">
                          {canModify && (
                            <button
                              onClick={() => startEdit(comment)}
                              className="flex min-h-11 items-center gap-1 px-2 text-[11.5px] text-ink-3 hover:text-ink"
                            >
                              <Pencil className="size-3" /> Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeletingId(comment.id)}
                              className="flex min-h-11 items-center gap-1 px-2 text-[11.5px] text-ink-3 hover:text-danger"
                            >
                              <Trash2 className="size-3" /> Delete
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Delete comment?"
        description="The message will be removed and replaced with a deleted-message notice."
        confirmLabel="Delete comment"
        destructive
        loading={deleteComment.isPending}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
