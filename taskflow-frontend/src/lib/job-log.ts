"use client";

import { useSyncExternalStore } from "react";

/**
 * The API has no "list jobs" endpoint – a job id is only ever returned by
 * POST /tasks/:id/assign. To let people follow those notifications later, we
 * remember the ids returned to *this browser* and query GET /jobs/:id for each.
 */
export interface JobLogEntry {
  jobId: string;
  taskId: string;
  taskTitle: string;
  assigneeName: string;
  assigneeEmail?: string;
  createdAt: string;
}

const MAX_ENTRIES = 50;
const listeners = new Set<() => void>();
const EMPTY: string = "[]";

function key(userId: string): string {
  return `taskflow.jobs.v1.${userId}`;
}

function readRaw(userId: string): string {
  if (typeof window === "undefined") return EMPTY;
  try {
    return window.localStorage.getItem(key(userId)) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

export function addJobLogEntry(userId: string, entry: JobLogEntry): void {
  if (typeof window === "undefined") return;
  const existing = parse(readRaw(userId)).filter((e) => e.jobId !== entry.jobId);
  const next = [entry, ...existing].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function clearJobLog(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(userId));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function readStateKey(userId: string): string {
  return `taskflow.jobs.read.v1.${userId}`;
}

function readReadIds(userId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(readStateKey(userId)) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function markJobLogRead(userId: string, jobId: string): void {
  if (typeof window === "undefined") return;
  const ids = new Set(readReadIds(userId));
  ids.add(jobId);
  try {
    window.localStorage.setItem(readStateKey(userId), JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function markAllJobLogRead(userId: string, entries: JobLogEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(readStateKey(userId), JSON.stringify([...new Set([...readReadIds(userId), ...entries.map((e) => e.jobId)])]));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useReadJobIds(userId: string): Set<string> {
  const raw = useSyncExternalStore(
    subscribe,
    () => (typeof window === "undefined" ? "[]" : window.localStorage.getItem(readStateKey(userId)) ?? "[]"),
    () => "[]",
  );
  try {
    const value = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function parse(raw: string): JobLogEntry[] {
  try {
    const v = JSON.parse(raw) as JobLogEntry[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const cache = new Map<string, { raw: string; value: JobLogEntry[] }>();

export function useJobLog(userId: string): JobLogEntry[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(userId),
    () => EMPTY,
  );
  const hit = cache.get(userId);
  if (hit && hit.raw === raw) return hit.value;
  const value = parse(raw);
  cache.set(userId, { raw, value });
  return value;
}
