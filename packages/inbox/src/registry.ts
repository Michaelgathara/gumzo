import {
  sampleInboxState,
  selectContext,
  submitInboxMessage,
  type InboxState,
} from "@gumzo/domain";

export type InboxRegistryListener = (snapshot: InboxState) => void;

export interface InboxRegistry {
  focusContext(contextId: string): void;
  getSnapshot(): InboxState;
  replaceSnapshot(snapshot: InboxState): void;
  submitMessage(message: string): void;
  subscribe(listener: InboxRegistryListener): () => void;
}

export type MemoryInboxRegistryOptions = {
  clock?: () => string;
  initialSnapshot?: InboxState;
};

export function createMemoryInboxRegistry(
  options: MemoryInboxRegistryOptions = {},
): InboxRegistry {
  let snapshot = options.initialSnapshot ?? sampleInboxState;
  const clock = options.clock ?? (() => new Date().toISOString());
  const listeners = new Set<InboxRegistryListener>();

  function publish(nextSnapshot: InboxState) {
    if (Object.is(nextSnapshot, snapshot)) {
      return;
    }

    snapshot = nextSnapshot;

    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  return {
    focusContext(contextId) {
      publish(selectContext(snapshot, contextId));
    },

    getSnapshot() {
      return snapshot;
    },

    replaceSnapshot(nextSnapshot) {
      publish(nextSnapshot);
    },

    submitMessage(message) {
      publish(submitInboxMessage(snapshot, message, clock()));
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
