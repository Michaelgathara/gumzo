import { describe, expect, test } from "bun:test";

import {
  createOpenCodeSessionAdapter,
  type OpenCodeEventSourceLike,
} from "./opencode-http";
import type {
  OpenCodeSessionInfo,
  OpenCodeSessionMessage,
  OpenCodeSessionRecord,
  OpenCodeSessionStatus,
  OpenCodeTodo,
} from "./opencode";

describe("createOpenCodeSessionAdapter", () => {
  test("hydrates session records from HTTP endpoints", async () => {
    const requests: RequestSnapshot[] = [];
    const fetch = createFetchStub(requests, ({ pathname }) => {
      switch (pathname) {
        case "/api/session":
          return jsonResponse({
            data: [
              createSessionInfo({
                id: "ses_gumzo",
                location: {
                  directory: "/workspace/gumzo",
                  workspaceID: "gumzo",
                },
                subpath: "apps/web",
                title: "Unified inbox scaffold",
                updatedAt: "2026-06-28T09:30:00.000Z",
              }),
            ],
          });
        case "/session/status":
          return jsonResponse({
            ses_gumzo: { type: "busy" },
          });
        case "/api/session/ses_gumzo/context":
          return jsonResponse({
            data: [
              {
                agent: "Gumzo",
                content: [
                  {
                    id: "assistant_text_1",
                    text: "I am mapping the adapter boundary to real session calls.",
                    type: "text",
                  },
                ],
                id: "msg_assistant_1",
                time: {
                  completed: "2026-06-28T09:30:00.000Z",
                  created: "2026-06-28T09:29:00.000Z",
                },
                type: "assistant",
              },
            ] satisfies OpenCodeSessionMessage[],
          });
        case "/session/ses_gumzo/todo":
          return jsonResponse([
            {
              content: "Ship the OpenCode transport",
              priority: "high",
              status: "in_progress",
            },
          ] satisfies OpenCodeTodo[]);
        default:
          throw new Error(`Unhandled request ${pathname}`);
      }
    });

    const adapter = createOpenCodeSessionAdapter({
      baseUrl: "http://localhost:4096",
      directory: "/workspace/gumzo",
      fetch,
      sessionLimit: 12,
      subpath: "apps/web",
      workspaceID: "gumzo",
    });

    const hydration = await adapter.hydrate();

    expect(hydration.sessions).toHaveLength(1);
    expect(hydration.sessions[0]).toEqual<OpenCodeSessionRecord>({
      info: createSessionInfo({
        id: "ses_gumzo",
        location: {
          directory: "/workspace/gumzo",
          workspaceID: "gumzo",
        },
        subpath: "apps/web",
        title: "Unified inbox scaffold",
        updatedAt: "2026-06-28T09:30:00.000Z",
      }),
      messages: [
        {
          agent: "Gumzo",
          content: [
            {
              id: "assistant_text_1",
              text: "I am mapping the adapter boundary to real session calls.",
              type: "text",
            },
          ],
          id: "msg_assistant_1",
          time: {
            completed: "2026-06-28T09:30:00.000Z",
            created: "2026-06-28T09:29:00.000Z",
          },
          type: "assistant",
        },
      ],
      status: { type: "busy" },
      todos: [
        {
          content: "Ship the OpenCode transport",
          priority: "high",
          status: "in_progress",
        },
      ],
    });
    expect(requests[0]?.pathname).toBe("/api/session");
    expect(requests[0]?.searchParams.get("directory")).toBe("/workspace/gumzo");
    expect(requests[0]?.searchParams.get("workspace")).toBe("gumzo");
    expect(requests[0]?.searchParams.get("subpath")).toBe("apps/web");
    expect(requests[0]?.searchParams.get("limit")).toBe("12");
  });

  test("reads and commands a single session through the adapter", async () => {
    const requests: RequestSnapshot[] = [];
    const fetch = createFetchStub(requests, ({ method, pathname }) => {
      if (method === "GET" && pathname === "/api/session/ses_gumzo") {
        return jsonResponse({
          data: createSessionInfo({
            id: "ses_gumzo",
            title: "Unified inbox scaffold",
            updatedAt: "2026-06-28T09:30:00.000Z",
          }),
        });
      }

      if (method === "GET" && pathname === "/session/status") {
        return jsonResponse({
          ses_gumzo: {
            action: {
              label: "Answer question",
              message: "Which provider should we use?",
              provider: "openai",
              reason: "missing-input",
              title: "Need user input",
            },
            attempt: 1,
            message: "Which provider should we use?",
            next: 1,
            type: "retry",
          } satisfies OpenCodeSessionStatus,
        });
      }

      if (method === "GET" && pathname === "/api/session/ses_gumzo/context") {
        return jsonResponse({
          data: [
            {
              id: "msg_user_1",
              text: "Use the inbox seam we just built.",
              time: { created: "2026-06-28T09:31:00.000Z" },
              type: "user",
            },
          ] satisfies OpenCodeSessionMessage[],
        });
      }

      if (method === "GET" && pathname === "/session/ses_gumzo/todo") {
        return jsonResponse([
          {
            content: "Which provider should we use?",
            priority: "high",
            status: "pending",
          },
        ] satisfies OpenCodeTodo[]);
      }

      if (method === "POST" && pathname === "/api/session/ses_gumzo/prompt") {
        return jsonResponse({
          data: {
            admittedSeq: 42,
            id: "input_42",
            sessionID: "ses_gumzo",
            timeCreated: "2026-06-28T09:35:00.000Z",
          },
        });
      }

      if (
        method === "POST" &&
        [
          "/api/session/ses_gumzo/compact",
          "/api/session/ses_gumzo/interrupt",
          "/api/session/ses_gumzo/wait",
        ].includes(pathname)
      ) {
        return emptyResponse();
      }

      if (method === "POST" && pathname === "/api/session") {
        return jsonResponse({
          data: createSessionInfo({
            id: "ses_new",
            location: {
              directory: "/workspace/gumzo",
              workspaceID: "gumzo",
            },
            title: "New OpenCode session",
            updatedAt: "2026-06-28T09:36:00.000Z",
          }),
        });
      }

      if (method === "GET" && pathname === "/api/session/ses_new") {
        return jsonResponse({
          data: createSessionInfo({
            id: "ses_new",
            location: {
              directory: "/workspace/gumzo",
              workspaceID: "gumzo",
            },
            title: "New OpenCode session",
            updatedAt: "2026-06-28T09:36:00.000Z",
          }),
        });
      }

      if (method === "GET" && pathname === "/api/session/ses_new/context") {
        return jsonResponse({ data: [] satisfies OpenCodeSessionMessage[] });
      }

      if (method === "GET" && pathname === "/session/ses_new/todo") {
        return jsonResponse([] satisfies OpenCodeTodo[]);
      }

      throw new Error(`Unhandled request ${method} ${pathname}`);
    });

    const adapter = createOpenCodeSessionAdapter({
      baseUrl: "http://localhost:4096",
      fetch,
      workspaceID: "gumzo",
    });

    const session = await adapter.readSession("ses_gumzo");
    const admission = await adapter.prompt({
      delivery: "queue",
      prompt: { text: "Keep moving." },
      resume: true,
      sessionID: "ses_gumzo",
    });
    await adapter.compact("ses_gumzo");
    await adapter.interrupt("ses_gumzo");
    await adapter.wait("ses_gumzo");
    const created = await adapter.createSession({
      location: {
        directory: "/workspace/gumzo",
        workspaceID: "gumzo",
      },
    });

    expect(session.status.type).toBe("retry");
    expect(admission?.id).toBe("input_42");
    expect(created.info.id).toBe("ses_new");
    expect(
      requests.find(
        (request) => request.pathname === "/api/session/ses_gumzo/prompt",
      )?.body,
    ).toEqual({
      delivery: "queue",
      prompt: { text: "Keep moving." },
      resume: true,
    });
    expect(
      requests.find((request) => request.pathname === "/api/session")?.body,
    ).toEqual({
      agent: undefined,
      id: undefined,
      location: {
        directory: "/workspace/gumzo",
        workspaceID: "gumzo",
      },
    });
  });

  test("maps SSE events onto adapter events and refreshes created sessions", async () => {
    const source = new FakeEventSource();
    const requests: RequestSnapshot[] = [];
    const fetch = createFetchStub(requests, ({ pathname }) => {
      switch (pathname) {
        case "/api/session/ses_gumzo":
          return jsonResponse({
            data: createSessionInfo({
              id: "ses_gumzo",
              location: {
                directory: "/workspace/gumzo",
                workspaceID: "gumzo",
              },
              title: "Unified inbox scaffold",
              updatedAt: "2026-06-28T09:30:00.000Z",
            }),
          });
        case "/session/status":
          return jsonResponse({
            ses_gumzo: { type: "busy" },
          });
        case "/api/session/ses_gumzo/context":
          return jsonResponse({
            data: [] satisfies OpenCodeSessionMessage[],
          });
        case "/session/ses_gumzo/todo":
          return jsonResponse([] satisfies OpenCodeTodo[]);
        default:
          throw new Error(`Unhandled request ${pathname}`);
      }
    });

    const adapter = createOpenCodeSessionAdapter({
      baseUrl: "http://localhost:4096",
      createEventSource: () => source,
      directory: "/workspace/gumzo",
      fetch,
    });
    const received: unknown[] = [];
    const unsubscribe = await Promise.resolve(
      adapter.subscribe((event) => {
        received.push(event);
      }),
    );

    source.emit({ payload: { data: {}, type: "server.connected" } });
    source.emit({
      payload: {
        data: {
          sessionID: "ses_gumzo",
          status: { type: "busy" },
        },
        location: { directory: "/workspace/gumzo" },
        type: "session.status",
      },
    });
    source.emit({
      payload: {
        data: {
          sessionID: "ses_gumzo",
        },
        location: { directory: "/workspace/gumzo" },
        type: "session.created",
      },
    });
    source.emit({
      payload: {
        data: {
          sessionID: "ses_gumzo",
          timestamp: "2026-06-28T09:40:00.000Z",
        },
        durable: {
          aggregateID: "ses_gumzo",
          seq: 99,
          version: 1,
        },
        location: { directory: "/workspace/gumzo" },
        type: "session.next.text.ended",
      },
    });
    source.emit({
      payload: {
        data: {
          sessionID: "ses_elsewhere",
          status: { type: "busy" },
        },
        location: { directory: "/workspace/other" },
        type: "session.status",
      },
    });

    await flushAsyncWork();

    expect(received).toEqual([
      { type: "server.connected" },
      {
        sessionID: "ses_gumzo",
        status: { type: "busy" },
        type: "session.status",
      },
      {
        session: {
          info: createSessionInfo({
            id: "ses_gumzo",
            location: {
              directory: "/workspace/gumzo",
              workspaceID: "gumzo",
            },
            title: "Unified inbox scaffold",
            updatedAt: "2026-06-28T09:30:00.000Z",
          }),
          messages: [],
          status: { type: "busy" },
          todos: [],
        },
        type: "session.created",
      },
      {
        event: {
          sessionID: "ses_gumzo",
          timestamp: "2026-06-28T09:40:00.000Z",
          type: "session.next.text.ended",
        },
        sessionID: "ses_gumzo",
        type: "session.durable",
      },
    ]);

    unsubscribe();
    expect(source.closed).toBe(true);
  });
});

type RequestSnapshot = {
  body: unknown;
  method: string;
  pathname: string;
  searchParams: URLSearchParams;
};

class FakeEventSource implements OpenCodeEventSourceLike {
  closed = false;

  private readonly listeners = {
    error: new Set<EventSourceListener>(),
    message: new Set<EventSourceListener>(),
  };

  addEventListener(type: "error" | "message", listener: EventSourceListener) {
    this.listeners[type].add(listener);
  }

  close() {
    this.closed = true;
  }

  emit(payload: unknown) {
    const event = { data: JSON.stringify(payload) };

    for (const listener of this.listeners.message) {
      void listener(event);
    }
  }

  removeEventListener(
    type: "error" | "message",
    listener: EventSourceListener,
  ) {
    this.listeners[type].delete(listener);
  }
}

type EventSourceListener = (event: { data: string }) => void | Promise<void>;

function createFetchStub(
  requests: RequestSnapshot[],
  resolve: (request: RequestSnapshot) => Response | Promise<Response>,
) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input
          : input.url,
    );
    const bodyText = typeof init?.body === "string" ? init.body : undefined;
    const snapshot = {
      body: bodyText ? JSON.parse(bodyText) : undefined,
      method: init?.method ?? "GET",
      pathname: url.pathname,
      searchParams: new URLSearchParams(url.searchParams),
    } satisfies RequestSnapshot;

    requests.push(snapshot);

    return resolve(snapshot);
  };
}

function createSessionInfo(input: {
  id: string;
  location?: OpenCodeSessionInfo["location"];
  subpath?: string;
  title: string;
  updatedAt: string;
}) {
  return {
    id: input.id,
    location: input.location,
    subpath: input.subpath,
    time: {
      created: "2026-06-28T09:00:00.000Z",
      updated: input.updatedAt,
    },
    title: input.title,
  } satisfies OpenCodeSessionInfo;
}

function emptyResponse() {
  return new Response(null, {
    headers: {
      "content-type": "application/json",
    },
    status: 204,
  });
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    status: 200,
  });
}

async function flushAsyncWork() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}
