import {
  createMemoryInboxRegistry,
  createOpenCodeSessionAdapter,
  createSessionBackedInboxRegistry,
  type InboxRegistry,
} from "@gumzo/inbox";

export function createDefaultInboxRegistry(): InboxRegistry {
  const baseUrl = readEnv("VITE_OPENCODE_BASE_URL");

  if (!baseUrl) {
    return createMemoryInboxRegistry();
  }

  const adapter = createOpenCodeSessionAdapter({
    baseUrl,
    directory: readEnv("VITE_OPENCODE_DIRECTORY"),
    sessionLimit: readPositiveInteger("VITE_OPENCODE_SESSION_LIMIT"),
    subpath: readEnv("VITE_OPENCODE_SUBPATH"),
    workspaceID: readEnv("VITE_OPENCODE_WORKSPACE_ID"),
  });

  return createSessionBackedInboxRegistry({
    adapter,
    onCommandError(error, command) {
      console.error(`OpenCode ${command} failed.`, error);
    },
  });
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
