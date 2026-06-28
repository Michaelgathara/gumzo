import { createMemoryInboxRegistry, type InboxRegistry } from "@gumzo/inbox";
import { createMemo, createSignal, onCleanup, onMount } from "solid-js";

export function createInboxStore(
  registry: InboxRegistry = createMemoryInboxRegistry(),
) {
  const [inbox, setInbox] = createSignal(registry.getSnapshot());
  const [draft, setDraft] = createSignal("");

  const unsubscribe = registry.subscribe((snapshot) => {
    setInbox(snapshot);
  });

  onMount(() => {
    if (!isConnectableRegistry(registry)) {
      return;
    }

    void registry.connect().catch((error) => {
      console.error("Failed to connect the inbox registry.", error);
    });
  });

  onCleanup(() => {
    unsubscribe();

    if (!isConnectableRegistry(registry)) {
      return;
    }

    void registry.disconnect().catch((error) => {
      console.error("Failed to disconnect the inbox registry.", error);
    });
  });

  const activeContext = createMemo(() => {
    const current = inbox();

    return (
      current.contexts.find(
        (context) => context.id === current.activeContextId,
      ) ?? current.contexts[0]
    );
  });

  const canSubmit = createMemo(() => draft().trim().length > 0);

  function focusContext(contextId: string) {
    registry.focusContext(contextId);
  }

  function submitDraft() {
    const message = draft().trim();

    if (!message) {
      return;
    }

    registry.submitMessage(message);
    setDraft("");
  }

  return {
    activeContext,
    canSubmit,
    draft,
    focusContext,
    inbox,
    setDraft,
    submitDraft,
  };
}

function isConnectableRegistry(
  registry: InboxRegistry,
): registry is InboxRegistry & {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
} {
  return (
    "connect" in registry &&
    typeof registry.connect === "function" &&
    "disconnect" in registry &&
    typeof registry.disconnect === "function"
  );
}
