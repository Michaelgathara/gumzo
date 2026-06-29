import { describe, expect, test } from "bun:test";

import { sampleInboxState } from "./demo-data";
import {
  getChildContexts,
  getContextLineage,
  getWaitingContexts,
  groupContextsByRailBucket,
  previewInboxRoute,
  selectContext,
  submitInboxMessage,
} from "./inbox";

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
    expect(createdContext?.parentContextId).toBe("gumzo-scaffold");
    expect(createdContext?.title).toStartWith(
      "sketch a pricing page information",
    );
  });

  test("drops the new topic prefix when titling a fresh context", () => {
    const next = submitInboxMessage(
      sampleInboxState,
      "New topic: Parent inbox navigation",
      "2026-06-28T09:15:00.000Z",
    );

    const createdContext = next.contexts.find(
      (context) => context.id === "context-6",
    );

    expect(next.routeDecision.strategy).toBe("start-new");
    expect(createdContext?.title).toBe("Parent inbox navigation");
  });
});

describe("previewInboxRoute", () => {
  test("predicts a pending-input reply before submission", () => {
    const preview = previewInboxRoute(
      sampleInboxState,
      "Use Google for the alpha.",
    );

    expect(preview?.strategy).toBe("answer-pending");
    expect(preview?.targetContextId).toBe("auth-provider");
  });

  test("predicts the optimistic context id for fresh work", () => {
    const preview = previewInboxRoute(
      sampleInboxState,
      "New topic: Parent inbox navigation",
    );

    expect(preview?.strategy).toBe("start-new");
    expect(preview?.targetContextId).toBe("context-6");
  });
});

describe("lineage helpers", () => {
  test("returns the parent chain and child contexts for a branched thread", () => {
    const lineage = getContextLineage(sampleInboxState, "founder-letter");
    const children = getChildContexts(sampleInboxState, "gumzo-scaffold");

    expect(lineage.map((context) => context.id)).toEqual([
      "gumzo-scaffold",
      "market-scan",
      "founder-letter",
    ]);
    expect(children.map((context) => context.id)).toEqual([
      "auth-provider",
      "market-scan",
    ]);
  });

  test("treats pending prompts as a first-class waiting queue", () => {
    const waiting = getWaitingContexts(sampleInboxState);
    const rail = groupContextsByRailBucket(sampleInboxState.contexts);

    expect(waiting.map((context) => context.id)).toEqual(["auth-provider"]);
    expect(rail["needs-you"].map((context) => context.id)).toEqual([
      "auth-provider",
    ]);
  });
});
