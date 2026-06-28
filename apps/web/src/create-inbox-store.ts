import { createMemoryInboxRegistry, type InboxRegistry } from "@gumzo/inbox";
import { createMemo, createSignal, onCleanup } from "solid-js";

export function createInboxStore(
  registry: InboxRegistry = createMemoryInboxRegistry(),
) {
  const [inbox, setInbox] = createSignal(registry.getSnapshot());
  const [draft, setDraft] = createSignal("");

  const unsubscribe = registry.subscribe((snapshot) => {
    setInbox(snapshot);
  });

  onCleanup(unsubscribe);

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
