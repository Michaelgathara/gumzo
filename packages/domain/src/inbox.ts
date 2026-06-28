import { z } from "zod";

export const toolScopeSchema = z.enum([
  "browser",
  "calendar",
  "code",
  "docs",
  "email",
]);
export type ToolScope = z.infer<typeof toolScopeSchema>;

export const contextStateSchema = z.enum([
  "needs-input",
  "running",
  "idle",
  "done",
  "failed",
]);
export type ContextState = z.infer<typeof contextStateSchema>;

export const railBucketKeySchema = z.enum([
  "needs-you",
  "running",
  "recent",
  "done",
]);
export type RailBucketKey = z.infer<typeof railBucketKeySchema>;

export const pendingItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["approval", "missing-data", "question"]),
  prompt: z.string().min(1),
});
export type PendingItem = z.infer<typeof pendingItemSchema>;

export const contextSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  state: contextStateSchema,
  updatedAt: z.iso.datetime(),
  pendingItems: z.array(pendingItemSchema),
  scope: z.object({
    workspace: z.string().min(1).optional(),
    tools: z.array(toolScopeSchema),
  }),
});
export type ContextSummary = z.infer<typeof contextSummarySchema>;

export const routeDecisionSchema = z.object({
  strategy: z.enum([
    "answer-pending",
    "confirm-choice",
    "continue-active",
    "revive-context",
    "start-new",
  ]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
});
export type RouteDecision = z.infer<typeof routeDecisionSchema>;

export const transcriptTurnSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["assistant", "system", "user"]),
  author: z.string().min(1),
  body: z.string().min(1),
  timestamp: z.iso.datetime(),
});
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;

export const inboxViewModelSchema = z.object({
  activeContextId: z.string().min(1),
  routeLabel: z.string().min(1),
  routeDecision: routeDecisionSchema,
  contexts: z.array(contextSummarySchema),
  transcript: z.array(transcriptTurnSchema),
});
export type InboxViewModel = z.infer<typeof inboxViewModelSchema>;

export function groupContextsByRailBucket(contexts: ContextSummary[]) {
  const grouped = {
    "needs-you": [] as ContextSummary[],
    running: [] as ContextSummary[],
    recent: [] as ContextSummary[],
    done: [] as ContextSummary[],
  };

  for (const context of contexts.toSorted((left, right) => {
    return (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  })) {
    grouped[toRailBucket(context.state)].push(context);
  }

  return grouped satisfies Record<RailBucketKey, ContextSummary[]>;
}

export function getContextStateLabel(state: ContextState) {
  switch (state) {
    case "needs-input":
      return "Needs input";
    case "running":
      return "Running";
    case "idle":
      return "Paused";
    case "done":
      return "Done";
    case "failed":
      return "Failed";
  }
}

function toRailBucket(state: ContextState): RailBucketKey {
  switch (state) {
    case "needs-input":
      return "needs-you";
    case "running":
      return "running";
    case "done":
      return "done";
    case "idle":
    case "failed":
      return "recent";
  }
}
