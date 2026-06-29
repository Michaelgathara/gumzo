import {
  createMemoryInboxRegistry,
  type InboxRegistry,
  type SessionBackedInboxRegistry,
} from "@gumzo/inbox";
import { createMemo, createSignal, onCleanup, onMount } from "solid-js";

import type { InboxRuntimeDescriptor } from "./create-default-inbox-registry";

type ContextCommand = "compact" | "interrupt" | "wait";
type CommandState = Record<ContextCommand, boolean>;
type RuntimeStatus = "connected" | "connecting" | "demo" | "error";

const idleCommandState: CommandState = {
  compact: false,
  interrupt: false,
  wait: false,
};

export function createInboxStore(
  input: InboxRegistry | InboxRuntimeDescriptor = createMemoryInboxRegistry(),
) {
  const descriptor = isRuntimeDescriptor(input)
    ? input
    : {
        registry: input,
        runtime: {
          kind: "memory" as const,
          label: "Demo memory registry",
        },
      };
  const { registry, runtime } = descriptor;
  const [inbox, setInbox] = createSignal(registry.getSnapshot());
  const [draft, setDraft] = createSignal("");
  const [commandState, setCommandState] = createSignal(idleCommandState);
  const [runtimeError, setRuntimeError] = createSignal<string>();
  const [runtimeStatus, setRuntimeStatus] = createSignal<RuntimeStatus>(
    runtime.kind === "memory" ? "demo" : "connecting",
  );

  const unsubscribe = registry.subscribe((snapshot) => {
    setInbox(snapshot);
  });

  async function connectRuntime() {
    if (!isConnectableRegistry(registry)) {
      return;
    }

    setRuntimeError(undefined);
    setRuntimeStatus("connecting");

    try {
      await registry.connect();
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(formatError(error));
      throw error;
    }
  }

  onMount(() => {
    if (!isConnectableRegistry(registry)) {
      return;
    }

    void connectRuntime().catch((error) => {
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
  const hasLiveRuntime = runtime.kind === "opencode";
  const canControlActiveContext = createMemo(
    () =>
      hasLiveRuntime &&
      runtimeStatus() === "connected" &&
      isSessionControlRegistry(registry) &&
      !!activeContext(),
  );
  const canCompactActiveContext = createMemo(() => canControlActiveContext());
  const canInterruptActiveContext = createMemo(
    () => canControlActiveContext() && activeContext()?.state === "running",
  );
  const canWaitForActiveContext = createMemo(
    () => canControlActiveContext() && activeContext()?.state === "running",
  );

  function focusContext(contextId: string) {
    registry.focusContext(contextId);
  }

  async function runActiveContextCommand(command: ContextCommand) {
    if (!isSessionControlRegistry(registry)) {
      return;
    }

    const context = activeContext();

    if (!context) {
      return;
    }

    setRuntimeError(undefined);
    setCommandState((current) => ({
      ...current,
      [command]: true,
    }));

    try {
      switch (command) {
        case "compact":
          await registry.compactContext(context.id);
          return;
        case "interrupt":
          await registry.interruptContext(context.id);
          return;
        case "wait":
          await registry.waitForContext(context.id);
          return;
      }
    } catch (error) {
      setRuntimeError(
        `Could not ${command} ${context.title}. ${formatError(error)}`,
      );
    } finally {
      setCommandState((current) => ({
        ...current,
        [command]: false,
      }));
    }
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
    canCompactActiveContext,
    canControlActiveContext,
    canInterruptActiveContext,
    canSubmit,
    canWaitForActiveContext,
    commandState,
    compactActiveContext: () => runActiveContextCommand("compact"),
    draft,
    focusContext,
    inbox,
    interruptActiveContext: () => runActiveContextCommand("interrupt"),
    reconnectRuntime: connectRuntime,
    runtime,
    runtimeError,
    runtimeStatus,
    setDraft,
    submitDraft,
    waitForActiveContext: () => runActiveContextCommand("wait"),
  };
}

function formatError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown runtime error.";
}

function isRuntimeDescriptor(
  input: InboxRegistry | InboxRuntimeDescriptor,
): input is InboxRuntimeDescriptor {
  return "runtime" in input && "registry" in input;
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

function isSessionControlRegistry(
  registry: InboxRegistry,
): registry is SessionBackedInboxRegistry {
  return (
    "compactContext" in registry &&
    typeof registry.compactContext === "function" &&
    "interruptContext" in registry &&
    typeof registry.interruptContext === "function" &&
    "waitForContext" in registry &&
    typeof registry.waitForContext === "function"
  );
}
