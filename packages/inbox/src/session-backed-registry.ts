import {
  getActiveContext,
  selectContext,
  submitInboxMessage,
  type InboxState,
} from "@gumzo/domain";

import {
  mapOpenCodeHydrationToInboxState,
  mapOpenCodeSessionToContextThread,
} from "./opencode-mapper";
import type {
  OpenCodeAdapterEvent,
  OpenCodeHydration,
  OpenCodeSessionAdapter,
  OpenCodeSessionID,
  OpenCodeSessionRecord,
} from "./opencode";
import type { InboxRegistry, InboxRegistryListener } from "./registry";

export interface SessionBackedInboxRegistry extends InboxRegistry {
  compactContext(contextId: OpenCodeSessionID): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  interruptContext(contextId: OpenCodeSessionID): Promise<void>;
  waitForContext(contextId: OpenCodeSessionID): Promise<void>;
}

export type SessionBackedInboxRegistryOptions = {
  adapter: OpenCodeSessionAdapter;
  clock?: () => string;
  onCommandError?: (error: unknown, command: string) => void;
};

export function createSessionBackedInboxRegistry(
  options: SessionBackedInboxRegistryOptions,
): SessionBackedInboxRegistry {
  let sourceState: OpenCodeHydration = { sessions: [] };
  let viewState: InboxState = mapOpenCodeHydrationToInboxState(sourceState);
  let disconnectAdapter: undefined | (() => void | Promise<void>);
  const clock = options.clock ?? (() => new Date().toISOString());
  const listeners = new Set<InboxRegistryListener>();

  function publish(nextState: InboxState) {
    if (Object.is(nextState, viewState)) {
      return;
    }

    viewState = nextState;

    for (const listener of listeners) {
      listener(viewState);
    }
  }

  function reconcileFromSource() {
    publish(mapOpenCodeHydrationToInboxState(sourceState, viewState));
  }

  function hasSessionRecord(sessionID: OpenCodeSessionID) {
    return sourceState.sessions.some(
      (session) => session.info.id === sessionID,
    );
  }

  async function refreshSession(sessionID: OpenCodeSessionID) {
    const refreshed = await options.adapter.readSession(sessionID);
    sourceState = {
      sessions: upsertSessionRecord(sourceState.sessions, refreshed),
    };
    reconcileFromSource();
  }

  async function promptSession(sessionID: OpenCodeSessionID, message: string) {
    try {
      await options.adapter.prompt({
        delivery: "queue",
        prompt: { text: message },
        resume: true,
        sessionID,
      });
    } catch (error) {
      reportCommandError(error, "prompt");
    }
  }

  async function createAndPromptSession(
    message: string,
    optimisticContextId: string,
    seedSession?: OpenCodeSessionRecord,
  ) {
    try {
      const created = await options.adapter.createSession({
        location: seedSession?.info.location,
        parentID: seedSession?.info.id,
        subpath: seedSession?.info.subpath,
      });

      sourceState = {
        sessions: upsertSessionRecord(sourceState.sessions, created),
      };

      publish(adoptCreatedSession(viewState, optimisticContextId, created));
      await promptSession(created.info.id, message);
    } catch (error) {
      reportCommandError(error, "session.create");
    }
  }

  async function handleEvent(event: OpenCodeAdapterEvent) {
    switch (event.type) {
      case "server.connected":
        return;
      case "session.created":
      case "session.updated":
        sourceState = {
          sessions: upsertSessionRecord(sourceState.sessions, event.session),
        };
        reconcileFromSource();
        return;
      case "session.deleted":
        sourceState = {
          sessions: sourceState.sessions.filter(
            (session) => session.info.id !== event.sessionID,
          ),
        };
        reconcileFromSource();
        return;
      case "session.status":
        if (!hasSessionRecord(event.sessionID)) {
          await refreshSession(event.sessionID);
          return;
        }

        sourceState = {
          sessions: sourceState.sessions.map((session) =>
            session.info.id === event.sessionID
              ? { ...session, status: event.status }
              : session,
          ),
        };
        reconcileFromSource();
        return;
      case "todo.updated":
        if (!hasSessionRecord(event.sessionID)) {
          await refreshSession(event.sessionID);
          return;
        }

        sourceState = {
          sessions: sourceState.sessions.map((session) =>
            session.info.id === event.sessionID
              ? { ...session, todos: event.todos }
              : session,
          ),
        };
        reconcileFromSource();
        return;
      case "session.durable":
        await refreshSession(event.sessionID);
        return;
    }
  }

  function reportCommandError(error: unknown, command: string) {
    options.onCommandError?.(error, command);
  }

  async function disconnectAdapterSubscription() {
    if (!disconnectAdapter) {
      return;
    }

    await disconnectAdapter();
    disconnectAdapter = undefined;
  }

  return {
    async compactContext(contextId) {
      await options.adapter.compact(contextId);
    },

    async connect() {
      await disconnectAdapterSubscription();
      sourceState = await options.adapter.hydrate();
      reconcileFromSource();
      disconnectAdapter = await options.adapter.subscribe(handleEvent);
    },

    async disconnect() {
      await disconnectAdapterSubscription();
    },

    focusContext(contextId) {
      publish(selectContext(viewState, contextId));
    },

    getSnapshot() {
      return viewState;
    },

    async interruptContext(contextId) {
      await options.adapter.interrupt(contextId);
    },

    replaceSnapshot(snapshot) {
      publish(snapshot);
    },

    submitMessage(message) {
      const trimmed = message.trim();

      if (!trimmed) {
        return;
      }

      const activeContext = getActiveContext(viewState);

      if (!activeContext) {
        return;
      }

      const seedSession = sourceState.sessions.find(
        (session) => session.info.id === activeContext.id,
      );
      const nextState = submitInboxMessage(viewState, trimmed, clock());
      const targetContextId = nextState.routeDecision.targetContextId;

      publish(nextState);

      if (nextState.routeDecision.strategy === "start-new") {
        void createAndPromptSession(trimmed, targetContextId, seedSession);
        return;
      }

      void promptSession(targetContextId, trimmed);
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    async waitForContext(contextId) {
      await options.adapter.wait(contextId);
    },
  };
}

function upsertSessionRecord(
  sessions: OpenCodeSessionRecord[],
  refreshed: OpenCodeSessionRecord,
) {
  const existingIndex = sessions.findIndex(
    (session) => session.info.id === refreshed.info.id,
  );

  if (existingIndex === -1) {
    return [...sessions, refreshed];
  }

  return sessions.map((session, index) =>
    index === existingIndex ? refreshed : session,
  );
}

function adoptCreatedSession(
  snapshot: InboxState,
  optimisticContextId: string,
  created: OpenCodeSessionRecord,
) {
  const createdContext = mapOpenCodeSessionToContextThread(created);
  const optimisticContext = snapshot.contexts.find(
    (context) => context.id === optimisticContextId,
  );

  if (!optimisticContext) {
    return {
      ...snapshot,
      activeContextId: created.info.id,
      contexts: [...snapshot.contexts, createdContext].toSorted(
        sortContextsByUpdatedAtDescending,
      ),
      routeDecision: {
        ...snapshot.routeDecision,
        targetContextId: created.info.id,
      },
    };
  }

  const mergedContext = {
    ...createdContext,
    id: created.info.id,
    parentContextId:
      createdContext.parentContextId ?? optimisticContext.parentContextId,
    pendingItems:
      optimisticContext.pendingItems.length > 0
        ? optimisticContext.pendingItems
        : createdContext.pendingItems,
    scope: {
      tools: optimisticContext.scope.tools,
      workspace:
        optimisticContext.scope.workspace ?? createdContext.scope.workspace,
    },
    state: optimisticContext.state,
    summary: optimisticContext.summary,
    title: optimisticContext.title,
    transcript: optimisticContext.transcript,
    updatedAt: optimisticContext.updatedAt,
  };

  return {
    ...snapshot,
    activeContextId:
      snapshot.activeContextId === optimisticContextId
        ? created.info.id
        : snapshot.activeContextId,
    contexts: [...snapshot.contexts]
      .filter(
        (context) =>
          context.id !== optimisticContextId && context.id !== created.info.id,
      )
      .concat(mergedContext)
      .toSorted(sortContextsByUpdatedAtDescending),
    routeDecision: {
      ...snapshot.routeDecision,
      targetContextId:
        snapshot.routeDecision.targetContextId === optimisticContextId
          ? created.info.id
          : snapshot.routeDecision.targetContextId,
    },
  };
}

function sortContextsByUpdatedAtDescending(
  left: InboxState["contexts"][number],
  right: InboxState["contexts"][number],
) {
  return (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}
