import { describe, expect, mock, test } from "bun:test";
import { sampleInboxState } from "@gumzo/domain";

import { createMemoryInboxRegistry } from "./registry";

describe("createMemoryInboxRegistry", () => {
  test("publishes snapshot updates when commands change the active context", () => {
    const registry = createMemoryInboxRegistry({
      initialSnapshot: sampleInboxState,
    });
    let publishedSnapshot = sampleInboxState;
    const listener = mock((snapshot = sampleInboxState) => {
      publishedSnapshot = snapshot;
    });

    const unsubscribe = registry.subscribe(listener);
    registry.focusContext("japan-trip");
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(publishedSnapshot.activeContextId).toBe("japan-trip");
    expect(registry.getSnapshot().routeDecision.strategy).toBe("manual-focus");
  });

  test("uses the injected clock for routed inbox messages", () => {
    const registry = createMemoryInboxRegistry({
      clock: () => "2026-06-28T09:30:00.000Z",
      initialSnapshot: sampleInboxState,
    });

    registry.submitMessage("Use Google for the alpha.");

    const snapshot = registry.getSnapshot();
    const activeContext = snapshot.contexts.find(
      (context) => context.id === "auth-provider",
    );

    expect(snapshot.activeContextId).toBe("auth-provider");
    expect(activeContext?.updatedAt).toBe("2026-06-28T09:30:00.000Z");
    expect(activeContext?.transcript.at(-1)?.timestamp).toBe(
      "2026-06-28T09:30:00.000Z",
    );
  });

  test("can be rehydrated with an external snapshot", () => {
    const registry = createMemoryInboxRegistry({
      initialSnapshot: sampleInboxState,
    });

    const replacement = {
      ...sampleInboxState,
      activeContextId: "founder-letter",
    };

    registry.replaceSnapshot(replacement);

    expect(registry.getSnapshot().activeContextId).toBe("founder-letter");
  });
});
