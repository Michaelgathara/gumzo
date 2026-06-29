import type {
  ContextState,
  ContextThread,
  InboxState,
  PendingItem,
  TranscriptTurn,
} from "@gumzo/domain";

import type {
  OpenCodeHydration,
  OpenCodeSessionMessage,
  OpenCodeSessionRecord,
  OpenCodeSessionStatus,
  OpenCodeTodo,
} from "./opencode";

export function mapOpenCodeHydrationToInboxState(
  hydration: OpenCodeHydration,
  previous?: InboxState,
): InboxState {
  const contexts = hydration.sessions
    .toSorted(sortRecordsByUpdatedAtDescending)
    .map(mapOpenCodeSessionToContextThread);
  const activeContextId = resolveActiveContextID(contexts, previous);
  const nextContextNumber = contexts.length + 1;
  const nextTurnNumber =
    contexts.reduce((count, context) => count + context.transcript.length, 0) +
    1;

  return {
    activeContextId,
    contexts,
    nextContextNumber,
    nextTurnNumber,
    routeDecision: previous?.routeDecision ?? {
      confidence: 1,
      rationale: "Hydrated the inbox from session-backed OpenCode data.",
      strategy: "continue-active",
      targetContextId: activeContextId,
    },
  };
}

export function mapOpenCodeSessionToContextThread(
  session: OpenCodeSessionRecord,
): ContextThread {
  return {
    id: session.info.id,
    parentContextId: session.info.parentID,
    pendingItems: mapPendingItems(session.status, session.todos),
    scope: {
      tools: inferToolScopes(session.messages),
      workspace:
        session.info.location?.workspaceID ??
        inferWorkspaceFromPath(session.info.subpath),
    },
    state: mapContextState(session),
    summary: summarizeSession(session),
    title: session.info.title,
    transcript: session.messages.map(mapMessageToTranscriptTurn),
    updatedAt: session.info.time.updated,
  };
}

function mapPendingItems(
  status: OpenCodeSessionStatus,
  todos: OpenCodeTodo[],
): PendingItem[] {
  const items: PendingItem[] = [];

  if (status.type === "retry") {
    items.push({
      id: `pending-retry-${status.attempt}`,
      prompt: status.action?.message ?? status.message,
      type: status.action ? "missing-data" : "question",
    });
  }

  for (const [index, todo] of todos.entries()) {
    if (todo.status !== "pending" || !todo.content.includes("?")) {
      continue;
    }

    items.push({
      id: `todo-${index + 1}`,
      prompt: todo.content,
      type: "question",
    });
  }

  return items;
}

function inferToolScopes(
  messages: OpenCodeSessionMessage[],
): ContextThread["scope"]["tools"] {
  const tools = new Set<ContextThread["scope"]["tools"][number]>(["docs"]);

  for (const message of messages) {
    if (message.type === "shell") {
      tools.add("code");
      continue;
    }

    if (message.type !== "assistant") {
      continue;
    }

    for (const content of message.content) {
      if (content.type === "tool") {
        tools.add("code");
      }
    }
  }

  return [...tools];
}

function inferWorkspaceFromPath(subpath?: string) {
  if (!subpath) {
    return undefined;
  }

  return subpath.split("/")[0];
}

function mapContextState(session: OpenCodeSessionRecord): ContextState {
  if (session.status.type === "retry") {
    return "needs-input";
  }

  if (session.status.type === "busy") {
    return "running";
  }

  if (
    session.todos.some(
      (todo) => todo.status === "pending" && todo.content.includes("?"),
    )
  ) {
    return "needs-input";
  }

  const latestAssistant = [...session.messages]
    .reverse()
    .find((message) => message.type === "assistant");

  if (latestAssistant?.error) {
    return "failed";
  }

  if (session.todos.some((todo) => todo.status === "in_progress")) {
    return "running";
  }

  if (
    session.todos.length > 0 &&
    session.todos.every(
      (todo) => todo.status === "completed" || todo.status === "cancelled",
    )
  ) {
    return "done";
  }

  return "idle";
}

function summarizeSession(session: OpenCodeSessionRecord) {
  if (session.status.type === "retry") {
    return session.status.action?.message ?? session.status.message;
  }

  const pendingTodo = session.todos.find((todo) => todo.status === "pending");

  if (pendingTodo) {
    return `Queued work: ${pendingTodo.content}`;
  }

  const inProgressTodo = session.todos.find(
    (todo) => todo.status === "in_progress",
  );

  if (inProgressTodo) {
    return `In progress: ${inProgressTodo.content}`;
  }

  const latestSummary = [...session.messages]
    .reverse()
    .map(extractSummaryText)
    .find(Boolean);

  return latestSummary ?? "Session hydrated from OpenCode.";
}

function mapMessageToTranscriptTurn(
  message: OpenCodeSessionMessage,
): TranscriptTurn {
  return {
    author: resolveAuthor(message),
    body: resolveBody(message),
    id: message.id,
    role: resolveRole(message),
    timestamp: resolveTimestamp(message),
  };
}

function resolveAuthor(message: OpenCodeSessionMessage) {
  switch (message.type) {
    case "assistant":
      return message.agent;
    case "compaction":
      return "Compaction";
    case "shell":
      return "Shell";
    case "synthetic":
      return "Synthetic";
    case "system":
      return "System";
    case "user":
      return "User";
  }
}

function resolveBody(message: OpenCodeSessionMessage) {
  switch (message.type) {
    case "assistant": {
      const textParts = message.content
        .map((content) => {
          switch (content.type) {
            case "reasoning":
              return "";
            case "text":
              return content.text;
            case "tool":
              return `Tool ${content.name} ${content.state.status}.`;
          }
        })
        .filter(Boolean);

      if (textParts.length > 0) {
        return textParts.join("\n\n");
      }

      return message.error?.message ?? "Assistant updated the session.";
    }
    case "compaction":
      return `${message.summary}\n\nRecent context: ${message.recent}`;
    case "shell":
      return `${message.command}\n\n${message.output}`.trim();
    case "synthetic":
    case "system":
    case "user":
      return message.text;
  }
}

function resolveRole(message: OpenCodeSessionMessage): TranscriptTurn["role"] {
  switch (message.type) {
    case "assistant":
      return "assistant";
    case "user":
      return "user";
    case "compaction":
    case "shell":
    case "synthetic":
    case "system":
      return "system";
  }
}

function resolveTimestamp(message: OpenCodeSessionMessage) {
  return message.time.created;
}

function extractSummaryText(message: OpenCodeSessionMessage) {
  const body = resolveBody(message);
  const sentence = body.split(/\r?\n/)[0]?.trim();

  if (!sentence) {
    return undefined;
  }

  return sentence.length <= 120
    ? sentence
    : `${sentence.slice(0, 119).trimEnd()}…`;
}

function resolveActiveContextID(
  contexts: ContextThread[],
  previous?: InboxState,
): string {
  if (previous?.activeContextId) {
    const existing = contexts.find(
      (context) => context.id === previous.activeContextId,
    );

    if (existing) {
      return existing.id;
    }
  }

  const preferred =
    contexts.find((context) => context.pendingItems.length > 0) ??
    contexts.find((context) => context.state === "running") ??
    contexts[0];

  return preferred?.id ?? "session-unavailable";
}

function sortRecordsByUpdatedAtDescending(
  left: OpenCodeSessionRecord,
  right: OpenCodeSessionRecord,
) {
  return (
    new Date(right.info.time.updated).getTime() -
    new Date(left.info.time.updated).getTime()
  );
}
