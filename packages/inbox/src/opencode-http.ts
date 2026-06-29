import type {
  OpenCodeAdapterEvent,
  OpenCodeDurableEventType,
  OpenCodeHydration,
  OpenCodePromptAdmission,
  OpenCodeSessionAdapter,
  OpenCodeSessionID,
  OpenCodeSessionInfo,
  OpenCodeSessionMessage,
  OpenCodeSessionRecord,
  OpenCodeSessionStatus,
  OpenCodeTodo,
} from "./opencode";

type OpenCodeFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type EventSourceListener = (event: { data: string }) => void | Promise<void>;

export interface OpenCodeEventSourceLike {
  addEventListener(
    type: "error" | "message",
    listener: EventSourceListener,
  ): void;
  close(): void;
  removeEventListener(
    type: "error" | "message",
    listener: EventSourceListener,
  ): void;
}

type OpenCodeEventSourceConstructor = new (
  url: string,
  init?: {
    withCredentials?: boolean;
  },
) => OpenCodeEventSourceLike;

export type OpenCodeEventSourceFactory = (
  url: string,
) => OpenCodeEventSourceLike;

export type OpenCodeHttpSessionAdapterOptions = {
  baseUrl: string;
  createEventSource?: OpenCodeEventSourceFactory;
  directory?: string;
  fetch?: OpenCodeFetch;
  sessionLimit?: number;
  subpath?: string;
  workspaceID?: string;
};

type OpenCodeDurableEnvelope = {
  durable?: {
    aggregateID: string;
    seq: number;
    version: number;
  };
  location?: {
    directory?: string;
    workspaceID?: string;
  };
  type: string;
} & Record<string, unknown>;

type OpenCodeWrappedEvent = {
  payload?: OpenCodeDurableEnvelope;
} & Record<string, unknown>;

type OpenCodeListResponse = {
  data: OpenCodeSessionInfo[];
};

type OpenCodeDetailResponse = {
  data: OpenCodeSessionInfo;
};

type OpenCodeMessagesResponse = {
  data: OpenCodeSessionMessage[];
};

type OpenCodeStatusResponse = Record<OpenCodeSessionID, OpenCodeSessionStatus>;

function defaultEventSourceFactory(url: string) {
  const EventSourceConstructor = globalThis.EventSource as
    | OpenCodeEventSourceConstructor
    | undefined;

  if (!EventSourceConstructor) {
    throw new Error("EventSource is not available in this runtime.");
  }

  return new EventSourceConstructor(url, { withCredentials: true });
}

export function createOpenCodeSessionAdapter(
  options: OpenCodeHttpSessionAdapterOptions,
): OpenCodeSessionAdapter {
  const baseUrl = trimTrailingSlash(options.baseUrl);
  const createEventSource =
    options.createEventSource ?? defaultEventSourceFactory;
  const request = options.fetch ?? fetch;
  const sessionLimit = options.sessionLimit ?? 24;

  return {
    async compact(sessionID) {
      await requestVoid(
        request,
        buildUrl(baseUrl, `/api/session/${sessionID}/compact`),
        {
          method: "POST",
        },
      );
    },

    async createSession(command = {}) {
      const response = await requestJson<OpenCodeDetailResponse>(
        request,
        buildUrl(baseUrl, "/api/session"),
        {
          body: JSON.stringify({
            agent: command.agent,
            id: command.id,
            location: resolveCreateSessionLocation(command.location, options),
            model: command.model,
            parentID: command.parentID,
            subpath: command.subpath ?? options.subpath,
          }),
          method: "POST",
        },
      );

      return readSessionRecord(request, baseUrl, response.data.id, options);
    },

    async hydrate() {
      const [listing, statuses] = await Promise.all([
        requestJson<OpenCodeListResponse>(
          request,
          buildUrl(baseUrl, "/api/session", {
            directory: options.directory,
            limit: sessionLimit,
            order: "desc",
            subpath: options.subpath,
            workspace: options.workspaceID,
          }),
        ),
        requestJson<OpenCodeStatusResponse>(
          request,
          buildUrl(baseUrl, "/session/status", {
            directory: options.directory,
            workspace: options.workspaceID,
          }),
        ),
      ]);

      const sessions = await Promise.allSettled(
        listing.data.map((info) =>
          readSessionRecordFromInfo(request, baseUrl, info, {
            directory: options.directory,
            status: statuses[info.id] ?? { type: "idle" },
            workspaceID: options.workspaceID,
          }),
        ),
      );

      return {
        sessions: sessions.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        ),
      } satisfies OpenCodeHydration;
    },

    async interrupt(sessionID) {
      await requestVoid(
        request,
        buildUrl(baseUrl, `/api/session/${sessionID}/interrupt`),
        {
          method: "POST",
        },
      );
    },

    async prompt(command) {
      const response = await requestJson<{ data: OpenCodePromptAdmission }>(
        request,
        buildUrl(baseUrl, `/api/session/${command.sessionID}/prompt`),
        {
          body: JSON.stringify({
            delivery: command.delivery,
            prompt: command.prompt,
            resume: command.resume,
          }),
          method: "POST",
        },
      );

      return response.data;
    },

    async readSession(sessionID) {
      return readSessionRecord(request, baseUrl, sessionID, options);
    },

    subscribe(listener) {
      const source = createEventSource(buildUrl(baseUrl, "/api/event"));
      let chain = Promise.resolve();

      const onMessage: EventSourceListener = (event) => {
        chain = chain
          .then(() =>
            handleStreamMessage({
              baseUrl,
              event: event.data,
              listener,
              options,
              request,
            }),
          )
          .catch(() => undefined);
      };

      const onError: EventSourceListener = () => undefined;

      source.addEventListener("message", onMessage);
      source.addEventListener("error", onError);

      return () => {
        source.removeEventListener("message", onMessage);
        source.removeEventListener("error", onError);
        source.close();
      };
    },

    async wait(sessionID) {
      await requestVoid(
        request,
        buildUrl(baseUrl, `/api/session/${sessionID}/wait`),
        {
          method: "POST",
        },
      );
    },
  };
}

async function handleStreamMessage(input: {
  baseUrl: string;
  event: string;
  listener: (event: OpenCodeAdapterEvent) => void | Promise<void>;
  options: Pick<OpenCodeHttpSessionAdapterOptions, "directory" | "workspaceID">;
  request: OpenCodeFetch;
}) {
  const payload = parseEventPayload(input.event);

  if (!payload || !eventMatchesScope(payload, input.options)) {
    return;
  }

  const properties = getEventProperties(payload);

  switch (payload.type) {
    case "server.connected":
      await input.listener({ type: "server.connected" });
      return;
    case "session.status": {
      const sessionID = readString(properties.sessionID);
      const status = properties.status as OpenCodeSessionStatus | undefined;

      if (!sessionID || !status) {
        return;
      }

      await input.listener({
        sessionID,
        status,
        type: "session.status",
      });
      return;
    }
    case "todo.updated": {
      const sessionID = readString(properties.sessionID);
      const todos = readTodos(properties.todos);

      if (!sessionID || !todos) {
        return;
      }

      await input.listener({
        sessionID,
        todos,
        type: "todo.updated",
      });
      return;
    }
    case "session.created":
    case "session.updated": {
      const sessionID = extractSessionID(properties);

      if (!sessionID) {
        return;
      }

      const session = await readSessionRecord(
        input.request,
        input.baseUrl,
        sessionID,
        input.options,
      );

      await input.listener({
        session,
        type: payload.type,
      });
      return;
    }
    case "session.deleted": {
      const sessionID = extractSessionID(properties);

      if (!sessionID) {
        return;
      }

      await input.listener({
        sessionID,
        type: "session.deleted",
      });
      return;
    }
  }

  if (!payload.type.startsWith("session.next.")) {
    return;
  }

  if (!isDurableEventType(payload.type)) {
    return;
  }

  const sessionID = extractSessionID(properties);

  if (!sessionID) {
    return;
  }

  await input.listener({
    event: {
      sessionID,
      timestamp: readString(properties.timestamp) ?? new Date().toISOString(),
      type: payload.type,
    },
    sessionID,
    type: "session.durable",
  });
}

async function readSessionRecord(
  request: OpenCodeFetch,
  baseUrl: string,
  sessionID: OpenCodeSessionID,
  options: Pick<OpenCodeHttpSessionAdapterOptions, "directory" | "workspaceID">,
) {
  const [detail, statuses] = await Promise.all([
    requestJson<OpenCodeDetailResponse>(
      request,
      buildUrl(baseUrl, `/api/session/${sessionID}`),
    ),
    requestJson<OpenCodeStatusResponse>(
      request,
      buildUrl(baseUrl, "/session/status", {
        directory: options.directory,
        workspace: options.workspaceID,
      }),
    ),
  ]);

  return readSessionRecordFromInfo(request, baseUrl, detail.data, {
    directory: options.directory,
    status: statuses[sessionID] ?? { type: "idle" },
    workspaceID: options.workspaceID,
  });
}

async function readSessionRecordFromInfo(
  request: OpenCodeFetch,
  baseUrl: string,
  info: OpenCodeSessionInfo,
  options: {
    directory?: string;
    status: OpenCodeSessionStatus;
    workspaceID?: string;
  },
): Promise<OpenCodeSessionRecord> {
  const [messages, todos] = await Promise.all([
    requestJson<OpenCodeMessagesResponse>(
      request,
      buildUrl(baseUrl, `/api/session/${info.id}/context`),
    ),
    requestJson<OpenCodeTodo[]>(
      request,
      buildUrl(baseUrl, `/session/${info.id}/todo`, {
        directory: options.directory,
        workspace: options.workspaceID,
      }),
    ),
  ]);

  return {
    info,
    messages: messages.data,
    status: options.status,
    todos,
  };
}

async function requestJson<T>(
  request: OpenCodeFetch,
  url: string,
  init?: RequestInit,
) {
  const response = await request(url, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw await createHttpError(response);
  }

  return (await response.json()) as T;
}

async function requestVoid(
  request: OpenCodeFetch,
  url: string,
  init?: RequestInit,
) {
  const response = await request(url, {
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    throw await createHttpError(response);
  }
}

async function createHttpError(response: Response) {
  const body = await response.text();

  return new Error(
    `OpenCode request failed with ${response.status} ${response.statusText}: ${body}`.trim(),
  );
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, number | string | undefined>,
) {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(normalizedPath, `${baseUrl}/`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === "") {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function resolveCreateSessionLocation(
  location: OpenCodeSessionInfo["location"] | undefined,
  options: Pick<OpenCodeHttpSessionAdapterOptions, "directory" | "workspaceID">,
) {
  const directory = location?.directory ?? options.directory;
  const workspaceID = location?.workspaceID ?? options.workspaceID;

  if (!directory && !workspaceID) {
    return undefined;
  }

  return {
    directory,
    workspaceID,
  } satisfies OpenCodeSessionInfo["location"];
}

function parseEventPayload(raw: string) {
  const decoded = JSON.parse(raw) as
    | OpenCodeDurableEnvelope
    | OpenCodeWrappedEvent;

  if (isRecord(decoded.payload)) {
    return decoded.payload as OpenCodeDurableEnvelope;
  }

  return isRecord(decoded) ? (decoded as OpenCodeDurableEnvelope) : undefined;
}

function getEventProperties(event: OpenCodeDurableEnvelope) {
  if (isRecord(event.data)) {
    return event.data;
  }

  if (isRecord(event.properties)) {
    return event.properties;
  }

  return {};
}

function eventMatchesScope(
  event: OpenCodeDurableEnvelope,
  scope: Pick<OpenCodeHttpSessionAdapterOptions, "directory" | "workspaceID">,
) {
  if (!scope.directory && !scope.workspaceID) {
    return true;
  }

  const location = isRecord(event.location) ? event.location : undefined;

  if (!location) {
    return true;
  }

  if (
    scope.directory &&
    readString(location.directory) &&
    location.directory !== scope.directory
  ) {
    return false;
  }

  if (
    scope.workspaceID &&
    readString(location.workspaceID) &&
    location.workspaceID !== scope.workspaceID
  ) {
    return false;
  }

  return true;
}

function extractSessionID(properties: Record<string, unknown>) {
  const direct = readString(properties.sessionID);

  if (direct) {
    return direct;
  }

  const info = isRecord(properties.info) ? properties.info : undefined;

  return info ? readString(info.id) : undefined;
}

function readTodos(input: unknown) {
  if (!Array.isArray(input)) {
    return undefined;
  }

  return input as OpenCodeTodo[];
}

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDurableEventType(type: string): type is OpenCodeDurableEventType {
  return durableEventTypes.has(type as OpenCodeDurableEventType);
}

const durableEventTypes = new Set<OpenCodeDurableEventType>([
  "session.next.compaction.ended",
  "session.next.context.updated",
  "session.next.prompt.admitted",
  "session.next.prompted",
  "session.next.reasoning.ended",
  "session.next.step.ended",
  "session.next.step.failed",
  "session.next.step.started",
  "session.next.synthetic",
  "session.next.text.ended",
  "session.next.tool.called",
  "session.next.tool.failed",
  "session.next.tool.success",
]);
