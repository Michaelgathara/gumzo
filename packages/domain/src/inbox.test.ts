import { describe, expect, test } from "bun:test";

import { sampleInboxState } from "./demo-data";
import { selectContext, submitInboxMessage } from "./inbox";

describe("selectContext", () => {
  test("moves focus to the requested context and records a manual route decision", () => {
    const next = selectContext(sampleInboxState, "japan-trip");

    expect(next.activeContextId).toBe("japan-trip");
    expect(next.routeDecision.strategy).toBe("manual-focus");
    expect(next.routeDecision.targetContextId).toBe("japan-trip");
  });
});

describe("submitInboxMessage", () => {
  test("treats a short direct reply as an answer to the pending context", () => {
    const next = submitInboxMessage(
      sampleInboxState,
      "Use Google for the alpha.",
      "2026-06-28T09:00:00.000Z",
    );

    const authContext = next.contexts.find(
      (context) => context.id === "auth-provider",
    );

    expect(next.activeContextId).toBe("auth-provider");
    expect(next.routeDecision.strategy).toBe("answer-pending");
    expect(authContext?.state).toBe("running");
    expect(authContext?.pendingItems).toHaveLength(0);
    expect(authContext?.transcript.at(-2)?.body).toBe(
      "Use Google for the alpha.",
    );
  });

  test("revives a named context when the message clearly references it", () => {
    const next = submitInboxMessage(
      sampleInboxState,
      "Go back to the Japan trip and optimize the Tokyo hotel choices.",
      "2026-06-28T09:05:00.000Z",
    );

    expect(next.activeContextId).toBe("japan-trip");
    expect(next.routeDecision.strategy).toBe("revive-context");
  });

  test("starts a new context when the message explicitly asks for one", () => {
    const next = submitInboxMessage(
      sampleInboxState,
      "New: sketch a pricing page information architecture",
      "2026-06-28T09:10:00.000Z",
    );

    const createdContext = next.contexts.find(
      (context) => context.id === "context-6",
    );

    expect(next.activeContextId).toBe("context-6");
    expect(next.routeDecision.strategy).toBe("start-new");
    expect(createdContext?.title).toStartWith(
      "sketch a pricing page information",
    );
  });
});
