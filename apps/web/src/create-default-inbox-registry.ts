import {
  createMemoryInboxRegistry,
  createOpenCodeSessionAdapter,
  createSessionBackedInboxRegistry,
  type InboxRegistry,
} from "@gumzo/inbox";

export type InboxRuntimeDescriptor = {
  registry: InboxRegistry;
  runtime: {
    endpoint?: string;
    kind: "memory" | "opencode";
    label: string;
    workspace?: string;
  };
};

export function createDefaultInboxRuntime(): InboxRuntimeDescriptor {
  const baseUrl = readEnv("VITE_OPENCODE_BASE_URL");

  if (!baseUrl) {
    return {
      registry: createMemoryInboxRegistry(),
      runtime: {
        kind: "memory",
        label: "Demo memory registry",
      },
    };
  }

  const adapter = createOpenCodeSessionAdapter({
    baseUrl,
    directory: readEnv("VITE_OPENCODE_DIRECTORY"),
    sessionLimit: readPositiveInteger("VITE_OPENCODE_SESSION_LIMIT"),
    subpath: readEnv("VITE_OPENCODE_SUBPATH"),
    workspaceID: readEnv("VITE_OPENCODE_WORKSPACE_ID"),
  });
  const registry = createSessionBackedInboxRegistry({
    adapter,
    onCommandError(error, command) {
      console.error(`OpenCode ${command} failed.`, error);
    },
  });

  return {
    registry,
    runtime: {
      endpoint: baseUrl,
      kind: "opencode",
      label: "OpenCode session runtime",
      workspace: readEnv("VITE_OPENCODE_WORKSPACE_ID"),
    },
  };
}

function readEnv(name: keyof ImportMetaEnv) {
  const value = import.meta.env[name];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readPositiveInteger(name: keyof ImportMetaEnv) {
  const value = readEnv(name);

  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
