import {
  sampleInboxState,
  selectContext,
  submitInboxMessage,
} from "@gumzo/domain";
import { createMemo, createSignal } from "solid-js";

export function createInboxStore() {
  const [inbox, setInbox] = createSignal(sampleInboxState);
  const [draft, setDraft] = createSignal("");

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
    setInbox((current) => selectContext(current, contextId));
  }

  function submitDraft() {
    const message = draft().trim();

    if (!message) {
      return;
    }

    setInbox((current) => submitInboxMessage(current, message));
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
