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

export const routeStrategySchema = z.enum([
  "answer-pending",
  "continue-active",
  "manual-focus",
  "revive-context",
  "start-new",
]);
export type RouteStrategy = z.infer<typeof routeStrategySchema>;

export const pendingItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["approval", "missing-data", "question"]),
  prompt: z.string().min(1),
});
export type PendingItem = z.infer<typeof pendingItemSchema>;

export const transcriptTurnSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["assistant", "system", "user"]),
  author: z.string().min(1),
  body: z.string().min(1),
  timestamp: z.iso.datetime(),
});
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;

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

export const contextThreadSchema = contextSummarySchema.extend({
  transcript: z.array(transcriptTurnSchema),
});
export type ContextThread = z.infer<typeof contextThreadSchema>;

export const routeDecisionSchema = z.object({
  strategy: routeStrategySchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  targetContextId: z.string().min(1),
});
export type RouteDecision = z.infer<typeof routeDecisionSchema>;

export const inboxStateSchema = z.object({
  activeContextId: z.string().min(1),
  contexts: z.array(contextThreadSchema),
  nextContextNumber: z.number().int().positive(),
  nextTurnNumber: z.number().int().positive(),
  routeDecision: routeDecisionSchema,
});
export type InboxState = z.infer<typeof inboxStateSchema>;

type MutableRoute = {
  confidence: number;
  rationale: string;
  strategy: RouteStrategy;
  targetContextId: string;
};

const assistantName = "Gumzo";
const userName = "Michael";

export function groupContextsByRailBucket(contexts: ContextSummary[]) {
  const grouped = {
    "needs-you": [] as ContextSummary[],
    running: [] as ContextSummary[],
    recent: [] as ContextSummary[],
    done: [] as ContextSummary[],
  };

  for (const context of contexts.toSorted(sortByUpdatedAtDescending)) {
    grouped[toRailBucket(context.state)].push(context);
  }

  return grouped satisfies Record<RailBucketKey, ContextSummary[]>;
}

export function getActiveContext(state: InboxState) {
  return (
    state.contexts.find((context) => context.id === state.activeContextId) ??
    state.contexts[0]
  );
}

export function selectContext(
  state: InboxState,
  contextId: string,
): InboxState {
  const target = state.contexts.find((context) => context.id === contextId);

  if (!target) {
    return state;
  }

  return {
    ...state,
    activeContextId: target.id,
    routeDecision: {
      strategy: "manual-focus",
      confidence: 1,
      rationale: `Moved the visible inbox to ${target.title} without changing any underlying context data.`,
      targetContextId: target.id,
    },
  };
}

export function submitInboxMessage(
  state: InboxState,
  message: string,
  now = new Date().toISOString(),
): InboxState {
  const trimmed = message.trim();

  if (!trimmed) {
    return state;
  }

  const route = determineRoute(state, trimmed);
  const contextId =
    route.strategy === "start-new"
      ? `context-${state.nextContextNumber}`
      : route.targetContextId;
  const userTurn = createTurn(
    state.nextTurnNumber,
    "user",
    userName,
    trimmed,
    now,
  );

  let contexts = state.contexts;
  let nextContextNumber = state.nextContextNumber;

  if (route.strategy === "start-new") {
    const title = createContextTitle(trimmed);
    const assistantTurn = createTurn(
      state.nextTurnNumber + 1,
      "assistant",
      assistantName,
      createAssistantReply(route, title),
      now,
    );
    const newContext: ContextThread = {
      id: contextId,
      title,
      summary: `Started from the inbox: ${toSummarySnippet(trimmed)}`,
      state: "running",
      updatedAt: now,
      pendingItems: [],
      scope: {
        workspace: "inbox",
        tools: ["docs"],
      },
      transcript: [userTurn, assistantTurn],
    };

    contexts = [newContext, ...state.contexts];
    nextContextNumber += 1;
  } else {
    const assistantTurn = createTurn(
      state.nextTurnNumber + 1,
      "assistant",
      assistantName,
      createAssistantReply(route, resolveTargetTitle(state, contextId)),
      now,
    );

    contexts = state.contexts.map((context) => {
      if (context.id !== contextId) {
        return context;
      }

      return {
        ...context,
        state: "running",
        pendingItems:
          route.strategy === "answer-pending" ? [] : context.pendingItems,
        summary: createUpdatedSummary(route.strategy, trimmed),
        updatedAt: now,
        transcript: [...context.transcript, userTurn, assistantTurn],
      };
    });
  }

  return {
    ...state,
    activeContextId: contextId,
    contexts: contexts.toSorted(sortByUpdatedAtDescending),
    nextContextNumber,
    nextTurnNumber: state.nextTurnNumber + 2,
    routeDecision: {
      ...route,
      targetContextId: contextId,
    },
  };
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

export function getRouteStrategyLabel(strategy: RouteStrategy) {
  switch (strategy) {
    case "answer-pending":
      return "Answer pending";
    case "continue-active":
      return "Continue active";
    case "manual-focus":
      return "Manual focus";
    case "revive-context":
      return "Revive context";
    case "start-new":
      return "Start new";
  }
}

function determineRoute(state: InboxState, message: string): MutableRoute {
  const normalized = normalizeText(message);
  const explicitMatch = findExplicitContextMatch(state, normalized);

  if (looksLikeNewTopic(normalized)) {
    return {
      strategy: "start-new",
      confidence: 0.92,
      rationale:
        "The message explicitly asked to start fresh, so it should become its own context.",
      targetContextId: state.activeContextId,
    };
  }

  if (explicitMatch && explicitMatch.id !== state.activeContextId) {
    return {
      strategy: "revive-context",
      confidence: 0.88,
      rationale: `The message explicitly referenced ${explicitMatch.title}, so the inbox revived that earlier context.`,
      targetContextId: explicitMatch.id,
    };
  }

  const pendingCandidate = findPendingAnswerCandidate(state, normalized);

  if (pendingCandidate) {
    return {
      strategy: "answer-pending",
      confidence: 0.82,
      rationale: `The message looks like a direct answer to the open question in ${pendingCandidate.title}, so the system treated it as a pending-input reply.`,
      targetContextId: pendingCandidate.id,
    };
  }

  const activeContext = getActiveContext(state);

  if (activeContext) {
    return {
      strategy: "continue-active",
      confidence: 0.94,
      rationale: `Matched the active ${activeContext.title} context by recency and defaulted to continuing the current workstream.`,
      targetContextId: activeContext.id,
    };
  }

  return {
    strategy: "start-new",
    confidence: 0.7,
    rationale:
      "No active context was available, so the inbox started a new one.",
    targetContextId: state.activeContextId,
  };
}

function findExplicitContextMatch(
  state: InboxState,
  normalizedMessage: string,
) {
  let bestMatch: ContextThread | undefined;
  let bestScore = 0;

  for (const context of state.contexts) {
    const score = getContextMatchScore(context, normalizedMessage);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = context;
    }
  }

  return bestScore >= 2 ? bestMatch : undefined;
}

function findPendingAnswerCandidate(
  state: InboxState,
  normalizedMessage: string,
) {
  const pendingContexts = state.contexts
    .filter((context) => context.state === "needs-input")
    .toSorted(sortByUpdatedAtDescending);

  if (pendingContexts.length !== 1) {
    return undefined;
  }

  if (
    normalizedMessage.includes("?") ||
    normalizedMessage.length > 120 ||
    looksLikeNewTopic(normalizedMessage)
  ) {
    return undefined;
  }

  return pendingContexts[0];
}

function looksLikeNewTopic(normalizedMessage: string) {
  return (
    normalizedMessage.startsWith("new:") ||
    normalizedMessage.startsWith("new topic") ||
    normalizedMessage.startsWith("start new")
  );
}

function getContextMatchScore(
  context: ContextThread,
  normalizedMessage: string,
) {
  let score = 0;
  const tokens = context.title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);

  for (const token of tokens) {
    if (normalizedMessage.includes(token)) {
      score += 1;
    }
  }

  if (
    context.scope.workspace &&
    normalizedMessage.includes(context.scope.workspace.toLowerCase())
  ) {
    score += 1;
  }

  return score;
}

function createAssistantReply(route: MutableRoute, title: string) {
  switch (route.strategy) {
    case "answer-pending":
      return `Attached that answer to ${title} and marked the context as running again.`;
    case "continue-active":
      return `Kept the message inside ${title} so the current workstream stays continuous.`;
    case "manual-focus":
      return `Focused the inbox on ${title}.`;
    case "revive-context":
      return `Switched the inbox back to ${title} and routed your message there.`;
    case "start-new":
      return `Started a fresh context so this message can evolve independently from the rest of the inbox.`;
  }
}

function createUpdatedSummary(strategy: RouteStrategy, message: string) {
  const snippet = toSummarySnippet(message);

  switch (strategy) {
    case "answer-pending":
      return `Unblocked from the inbox: ${snippet}`;
    case "continue-active":
      return `Updated from the inbox: ${snippet}`;
    case "manual-focus":
      return `Focused manually from the inbox.`;
    case "revive-context":
      return `Revived from the inbox: ${snippet}`;
    case "start-new":
      return `Started from the inbox: ${snippet}`;
  }
}

function resolveTargetTitle(state: InboxState, contextId: string) {
  return (
    state.contexts.find((context) => context.id === contextId)?.title ??
    "the selected context"
  );
}

function createContextTitle(message: string) {
  const base = message
    .replace(/^new:\s*/i, "")
    .replace(/^new topic:\s*/i, "")
    .replace(/^new topic\s*/i, "")
    .replace(/^start new\s*/i, "")
    .trim();

  const sentence = base.split(/[.!?]/)[0]?.trim() ?? "New context";
  const maxLength = 40;

  if (sentence.length <= maxLength) {
    return sentence || "New context";
  }

  return `${sentence.slice(0, maxLength - 1).trimEnd()}…`;
}

function createTurn(
  turnNumber: number,
  role: TranscriptTurn["role"],
  author: string,
  body: string,
  timestamp: string,
): TranscriptTurn {
  return {
    id: `turn-${turnNumber}`,
    role,
    author,
    body,
    timestamp,
  };
}

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function toSummarySnippet(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const maxLength = 88;

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
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

function sortByUpdatedAtDescending(
  left: ContextSummary,
  right: ContextSummary,
) {
  return (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}
