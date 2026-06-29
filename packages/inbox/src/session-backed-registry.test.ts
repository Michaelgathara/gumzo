import { describe, expect, mock, test } from "bun:test";

import { createSessionBackedInboxRegistry } from "./session-backed-registry";
import type {
  OpenCodeAdapterEvent,
  OpenCodeHydration,
  OpenCodePromptCommand,
  OpenCodeSessionAdapter,
  OpenCodeSessionCreateCommand,
  OpenCodeSessionID,
  OpenCodeSessionRecord,
  OpenCodeSessionStatus,
  OpenCodeTodo,
} from "./opencode";

describe("createSessionBackedInboxRegistry", () => {
  test("hydrates OpenCode sessions into inbox contexts and preserves focus changes", async () => {
    const adapter = createMockAdapter();
    const registry = createSessionBackedInboxRegistry({ adapter });

    await registry.connect();
    registry.focusContext("ses_japan");

    const snapshot = registry.getSnapshot();

    expect(snapshot.activeContextId).toBe("ses_japan");
    expect(snapshot.contexts[0]?.title).toBe("Unified inbox scaffold");
    expect(
      snapshot.contexts.find((context) => context.id === "ses_gumzo")?.state,
    ).toBe("running");
    expect(
      snapshot.contexts.find((context) => context.id === "ses_auth")
        ?.pendingItems[0]?.prompt,
    ).toContain("Which provider");
  });

  test("routes prompts to the inbox-selected session and updates optimistically", async () => {
    const adapter = createMockAdapter();
    const registry = createSessionBackedInboxRegistry({
      adapter,
      clock: () => "2026-06-28T10:15:00.000Z",
    });

    await registry.connect();
    registry.focusContext("ses_gumzo");
    registry.submitMessage("Ship the local adapter seam next.");

    expect(adapter.promptCalls[0]).toEqual<OpenCodePromptCommand>({
      delivery: "queue",
      prompt: { text: "Ship the local adapter seam next." },
      resume: true,
      sessionID: "ses_auth",
    });
    expect(registry.getSnapshot().activeContextId).toBe("ses_auth");
    expect(registry.getSnapshot().routeDecision.strategy).toBe(
      "answer-pending",
    );
    expect(
      registry
        .getSnapshot()
        .contexts.find((context) => context.id === "ses_auth")
        ?.transcript.at(-2)?.body,
    ).toBe("Ship the local adapter seam next.");
  });

  test("creates a real session when the inbox starts a fresh context", async () => {
    const adapter = createMockAdapter();
    const registry = createSessionBackedInboxRegistry({
      adapter,
      clock: () => "2026-06-28T10:15:00.000Z",
    });

    await registry.connect();
    registry.focusContext("ses_gumzo");
    registry.submitMessage("new topic: Parent inbox navigation");
    await Promise.resolve();
    await Promise.resolve();

    expect(adapter.createSessionCalls[0]).toEqual<OpenCodeSessionCreateCommand>(
      {
        location: {
          directory: "/workspace/gumzo",
          workspaceID: "gumzo",
        },
        parentID: "ses_gumzo",
        subpath: "apps/web",
      },
    );
    expect(adapter.promptCalls[0]?.sessionID).toBe("ses_new_1");
    expect(registry.getSnapshot().activeContextId).toBe("ses_new_1");
    expect(registry.getSnapshot().routeDecision.targetContextId).toBe(
      "ses_new_1",
    );
    expect(
      registry
        .getSnapshot()
        .contexts.find((context) => context.id === "ses_new_1")?.title,
    ).toBe("Parent inbox navigation");
    expect(
      registry
        .getSnapshot()
        .contexts.find((context) => context.id === "ses_new_1")
        ?.parentContextId,
    ).toBe("ses_gumzo");
  });

  test("refreshes a session when a durable OpenCode event arrives", async () => {
    const adapter = createMockAdapter();
    const registry = createSessionBackedInboxRegistry({ adapter });

    await registry.connect();
    adapter.replaceSession("ses_gumzo", {
      messages: [
        ...adapter.getSession("ses_gumzo").messages,
        {
          agent: "Gumzo",
          content: [
            {
              id: "assistant_text_2",
              text: "The adapter seam is ready for a real OpenCode transport.",
              type: "text",
            },
          ],
          id: "msg_assistant_2",
          time: {
            completed: "2026-06-28T10:20:00.000Z",
            created: "2026-06-28T10:19:00.000Z",
          },
          type: "assistant",
        },
      ],
    });

    await adapter.emit({
      event: {
        sessionID: "ses_gumzo",
        timestamp: "2026-06-28T10:20:00.000Z",
        type: "session.next.text.ended",
      },
      sessionID: "ses_gumzo",
      type: "session.durable",
    });

    expect(
      registry
        .getSnapshot()
        .contexts.find((context) => context.id === "ses_gumzo")
        ?.transcript.at(-1)?.body,
    ).toBe("The adapter seam is ready for a real OpenCode transport.");
  });

  test("can proxy session control commands", async () => {
    const adapter = createMockAdapter();
    const registry = createSessionBackedInboxRegistry({ adapter });

    await registry.connect();
    await registry.compactContext("ses_gumzo");
    await registry.interruptContext("ses_gumzo");
    await registry.waitForContext("ses_gumzo");

    expect(adapter.compactCalls).toEqual(["ses_gumzo"]);
    expect(adapter.interruptCalls).toEqual(["ses_gumzo"]);
    expect(adapter.waitCalls).toEqual(["ses_gumzo"]);
  });
});

function createMockAdapter(): MockAdapter {
  return new MockAdapter({
    sessions: [
      createSessionRecord({
        id: "ses_auth",
        parentID: "ses_gumzo",
        messages: [
          {
            agent: "Gumzo",
            content: [
              {
                id: "assistant_text_auth",
                text: "I mapped the onboarding flow, but I need one product call before wiring auth.",
                type: "text",
              },
            ],
            id: "msg_auth_1",
            time: {
              completed: "2026-06-28T07:12:00.000Z",
              created: "2026-06-28T07:12:00.000Z",
            },
            type: "assistant",
          },
        ],
        status: {
          action: {
            label: "Choose provider",
            message:
              "Which provider should back sign-in for the first private alpha?",
            provider: "openai",
            reason: "missing-input",
            title: "Need product input",
          },
          attempt: 1,
          message:
            "Which provider should back sign-in for the first private alpha?",
          next: 1,
          type: "retry",
        },
        time: {
          created: "2026-06-28T07:00:00.000Z",
          updated: "2026-06-28T07:18:00.000Z",
        },
        title: "Auth provider decision",
        todos: [
          {
            content:
              "Which provider should back sign-in for the first private alpha?",
            priority: "high",
            status: "pending",
          },
        ],
      }),
      createSessionRecord({
        id: "ses_gumzo",
        messages: [
          {
            id: "msg_user_1",
            text: "Let’s turn the PRD into the first scaffold.",
            time: { created: "2026-06-28T08:38:00.000Z" },
            type: "user",
          },
          {
            agent: "Gumzo",
            content: [
              {
                id: "assistant_text_1",
                text: "I’m starting with the architecture boundary lines first.",
                type: "text",
              },
            ],
            id: "msg_assistant_1",
            time: {
              completed: "2026-06-28T08:39:00.000Z",
              created: "2026-06-28T08:39:00.000Z",
            },
            type: "assistant",
          },
        ],
        status: { type: "busy" },
        time: {
          created: "2026-06-28T08:20:00.000Z",
          updated: "2026-06-28T08:43:00.000Z",
        },
        location: {
          directory: "/workspace/gumzo",
          workspaceID: "gumzo",
        },
        subpath: "apps/web",
        title: "Unified inbox scaffold",
        todos: [
          {
            content: "Shape the inbox registry boundary",
            priority: "high",
            status: "in_progress",
          },
        ],
      }),
      createSessionRecord({
        id: "ses_japan",
        messages: [
          {
            id: "msg_trip_user",
            text: "Plan the Kyoto and Tokyo split.",
            time: { created: "2026-06-27T17:48:00.000Z" },
            type: "user",
          },
        ],
        status: { type: "idle" },
        time: {
          created: "2026-06-27T17:40:00.000Z",
          updated: "2026-06-27T18:15:00.000Z",
        },
        title: "Japan October trip",
        todos: [],
      }),
    ],
  });
}

class MockAdapter implements OpenCodeSessionAdapter {
  compactCalls: OpenCodeSessionID[] = [];
  createSessionCalls: OpenCodeSessionCreateCommand[] = [];
  interruptCalls: OpenCodeSessionID[] = [];
  promptCalls: OpenCodePromptCommand[] = [];
  waitCalls: OpenCodeSessionID[] = [];
  private nextCreatedSession = 1;

  private readonly listeners = new Set<
    (event: OpenCodeAdapterEvent) => void | Promise<void>
  >();

  constructor(private hydration: OpenCodeHydration) {}

  async compact(sessionID: OpenCodeSessionID) {
    this.compactCalls.push(sessionID);
  }

  async createSession(command: OpenCodeSessionCreateCommand = {}) {
    this.createSessionCalls.push(command);

    const created = createSessionRecord({
      id: command.id ?? `ses_new_${this.nextCreatedSession++}`,
      location: command.location,
      messages: [],
      parentID: command.parentID,
      status: { type: "idle" },
      subpath: command.subpath,
      time: {
        created: "2026-06-28T10:15:00.000Z",
        updated: "2026-06-28T10:15:00.000Z",
      },
      title: "New OpenCode session",
      todos: [],
    });

    this.hydration = {
      sessions: [created, ...this.hydration.sessions],
    };

    return created;
  }

  async emit(event: OpenCodeAdapterEvent) {
    for (const listener of this.listeners) {
      await listener(event);
    }
  }

  getSession(sessionID: OpenCodeSessionID) {
    const session = this.hydration.sessions.find(
      (candidate) => candidate.info.id === sessionID,
    );

    if (!session) {
      throw new Error(`Unknown session ${sessionID}`);
    }

    return session;
  }

  async hydrate() {
    return this.hydration;
  }

  async interrupt(sessionID: OpenCodeSessionID) {
    this.interruptCalls.push(sessionID);
  }

  async prompt(command: OpenCodePromptCommand) {
    this.promptCalls.push(command);
  }

  async readSession(sessionID: OpenCodeSessionID) {
    return this.getSession(sessionID);
  }

  replaceSession(
    sessionID: OpenCodeSessionID,
    patch: Partial<OpenCodeSessionRecord>,
  ) {
    this.hydration = {
      sessions: this.hydration.sessions.map((session) =>
        session.info.id === sessionID ? { ...session, ...patch } : session,
      ),
    };
  }

  async subscribe(
    listener: (event: OpenCodeAdapterEvent) => void | Promise<void>,
  ) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async wait(sessionID: OpenCodeSessionID) {
    this.waitCalls.push(sessionID);
  }
}

function createSessionRecord(input: {
  id: OpenCodeSessionID;
  location?: OpenCodeSessionRecord["info"]["location"];
  messages: OpenCodeSessionRecord["messages"];
  parentID?: OpenCodeSessionID;
  status: OpenCodeSessionStatus;
  subpath?: string;
  time: OpenCodeSessionRecord["info"]["time"];
  title: string;
  todos: OpenCodeTodo[];
}): OpenCodeSessionRecord {
  return {
    info: {
      id: input.id,
      location: input.location,
      parentID: input.parentID,
      subpath: input.subpath,
      time: input.time,
      title: input.title,
    },
    messages: input.messages,
    status: input.status,
    todos: input.todos,
  };
}
