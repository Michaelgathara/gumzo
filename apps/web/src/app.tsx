import {
  getContextStateLabel,
  getRouteStrategyLabel,
  groupContextsByRailBucket,
  type RailBucketKey,
} from "@gumzo/domain";
import { For, createMemo } from "solid-js";

import { createDefaultInboxRuntime } from "./create-default-inbox-registry";
import { createInboxStore } from "./create-inbox-store";

type RailSection = {
  key: RailBucketKey;
  label: string;
  eyebrow: string;
  emptyState: string;
};

const railSections: RailSection[] = [
  {
    key: "needs-you",
    label: "Needs You",
    eyebrow: "Unblock first",
    emptyState: "Nothing is waiting on the user right now.",
  },
  {
    key: "running",
    label: "Running",
    eyebrow: "In motion",
    emptyState: "No contexts are actively executing at the moment.",
  },
  {
    key: "recent",
    label: "Recent",
    eyebrow: "Easy to resume",
    emptyState: "No paused or dormant contexts are available yet.",
  },
  {
    key: "done",
    label: "Done",
    eyebrow: "Closed loops",
    emptyState: "Completed contexts will show up here.",
  },
];

const demoPrompts = [
  "Use Google for the alpha.",
  "Go back to the Japan trip and optimize the Tokyo hotel choices.",
  "New: sketch a pricing page information architecture",
] as const;

export function App() {
  const inbox = createInboxStore(createDefaultInboxRuntime());
  const rail = createMemo(() =>
    groupContextsByRailBucket(inbox.inbox().contexts),
  );
  const activeContext = inbox.activeContext;
  const routeDecision = createMemo(() => inbox.inbox().routeDecision);
  const routeTarget = createMemo(() =>
    inbox
      .inbox()
      .contexts.find(
        (context) => context.id === routeDecision().targetContextId,
      ),
  );
  const pendingPrompt = createMemo(() => activeContext()?.pendingItems[0]);
  const runtimeTarget = createMemo(() =>
    [inbox.runtime.workspace, inbox.runtime.endpoint]
      .filter(Boolean)
      .join(" · "),
  );
  const runtimeStatusLabel = createMemo(() => {
    switch (inbox.runtimeStatus()) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting";
      case "demo":
        return "Demo";
      case "error":
        return "Attention";
    }
  });
  const compactLabel = createMemo(() =>
    inbox.commandState().compact ? "Compacting..." : "Compact",
  );
  const interruptLabel = createMemo(() =>
    inbox.commandState().interrupt ? "Interrupting..." : "Interrupt",
  );
  const waitLabel = createMemo(() =>
    inbox.commandState().wait ? "Waiting..." : "Wait for idle",
  );

  return (
    <div class="app-shell">
      <div class="ambient ambient-left" />
      <div class="ambient ambient-right" />

      <header class="topbar">
        <div>
          <p class="eyebrow">Gumzo prototype</p>
          <h1>One inbox. Many contexts.</h1>
        </div>

        <div class="topbar-meta">
          <span class="meta-pill">{inbox.runtime.label}</span>
          <span class="meta-pill meta-pill-muted">{runtimeStatusLabel()}</span>
        </div>
      </header>

      <main class="workspace">
        <aside class="rail-stack">
          <section class="signal-card hero-card">
            <p class="eyebrow">Design thesis</p>
            <h2>Users should not manage sessions.</h2>
            <p>
              The visible interface is one conversation. The system keeps
              multiple hidden contexts with their own memory, tool scope, and
              execution state.
            </p>
            <div class="hero-grid">
              <Signal
                label="Last route"
                value={getRouteStrategyLabel(routeDecision().strategy)}
              />
              <Signal
                label="Confidence"
                value={`${Math.round(routeDecision().confidence * 100)}%`}
              />
            </div>
          </section>

          <For each={railSections}>
            {(section) => (
              <section class="rail-section">
                <div class="section-heading">
                  <div>
                    <p class="eyebrow">{section.eyebrow}</p>
                    <h2>{section.label}</h2>
                  </div>
                  <span class="count-pill">{rail()[section.key].length}</span>
                </div>

                <div class="context-list">
                  {rail()[section.key].length > 0 ? (
                    <For each={rail()[section.key]}>
                      {(context) => {
                        const isActive = createMemo(
                          () => activeContext()?.id === context.id,
                        );

                        return (
                          <button
                            class="context-card-button"
                            classList={{
                              "context-card-active": isActive(),
                            }}
                            type="button"
                            onClick={() => inbox.focusContext(context.id)}
                          >
                            <article class="context-card">
                              <div class="context-card-header">
                                <div>
                                  <h3>{context.title}</h3>
                                  <p>{context.summary}</p>
                                </div>
                                <span class="state-pill">
                                  {getContextStateLabel(context.state)}
                                </span>
                              </div>

                              <div class="context-card-footer">
                                <div class="chip-row">
                                  {context.scope.workspace ? (
                                    <span class="scope-chip">
                                      {context.scope.workspace}
                                    </span>
                                  ) : null}
                                  <For each={context.scope.tools}>
                                    {(tool) => (
                                      <span class="scope-chip">{tool}</span>
                                    )}
                                  </For>
                                </div>
                                <span class="timestamp">
                                  {formatTimestamp(context.updatedAt)}
                                </span>
                              </div>
                            </article>
                          </button>
                        );
                      }}
                    </For>
                  ) : (
                    <p class="empty-copy">{section.emptyState}</p>
                  )}
                </div>
              </section>
            )}
          </For>
        </aside>

        <section class="thread-shell">
          <div class="thread-header">
            <div>
              <p class="eyebrow">Active context</p>
              <h2>{activeContext()?.title}</h2>
              <p class="thread-summary">{activeContext()?.summary}</p>
            </div>
            <div class="header-badges">
              <span class="context-badge">
                {getContextStateLabel(activeContext()?.state ?? "idle")}
              </span>
              <span class="context-badge context-badge-ghost">
                {getRouteStrategyLabel(routeDecision().strategy)}
              </span>
            </div>
          </div>

          <section class="runtime-panel">
            <div class="runtime-panel-header">
              <div>
                <p class="eyebrow">Runtime</p>
                <h3>{inbox.runtime.label}</h3>
                <p class="runtime-copy">
                  {runtimeTarget()
                    ? runtimeTarget()
                    : "The inbox is currently running against the local demo registry."}
                </p>
              </div>

              <div class="runtime-badges">
                <span class="context-badge">{runtimeStatusLabel()}</span>
                {activeContext()?.id ? (
                  <span class="context-badge context-badge-ghost">
                    {activeContext()?.id}
                  </span>
                ) : null}
              </div>
            </div>

            <div class="runtime-actions">
              <button
                class="runtime-button runtime-button-secondary"
                disabled={!inbox.canInterruptActiveContext()}
                type="button"
                onClick={() => void inbox.interruptActiveContext()}
              >
                {interruptLabel()}
              </button>

              <button
                class="runtime-button runtime-button-secondary"
                disabled={!inbox.canWaitForActiveContext()}
                type="button"
                onClick={() => void inbox.waitForActiveContext()}
              >
                {waitLabel()}
              </button>

              <button
                class="runtime-button runtime-button-secondary"
                disabled={!inbox.canCompactActiveContext()}
                type="button"
                onClick={() => void inbox.compactActiveContext()}
              >
                {compactLabel()}
              </button>

              {inbox.runtime.kind === "opencode" ? (
                <button
                  class="runtime-button"
                  disabled={inbox.runtimeStatus() === "connecting"}
                  type="button"
                  onClick={() => void inbox.reconnectRuntime()}
                >
                  {inbox.runtimeStatus() === "connecting"
                    ? "Connecting..."
                    : "Reconnect"}
                </button>
              ) : null}
            </div>

            {inbox.runtimeError() ? (
              <p class="runtime-error">{inbox.runtimeError()}</p>
            ) : null}
          </section>

          {pendingPrompt() ? (
            <section class="pending-card">
              <p class="route-title">Pending input</p>
              <p>{pendingPrompt()?.prompt}</p>
            </section>
          ) : null}

          <div class="route-callout">
            <p class="route-title">Routed from the inbox</p>
            <p class="route-headline">
              {routeTarget()
                ? `${getRouteStrategyLabel(routeDecision().strategy)} → ${routeTarget()?.title}`
                : getRouteStrategyLabel(routeDecision().strategy)}
            </p>
            <p>{routeDecision().rationale}</p>
          </div>

          <div class="transcript">
            <For each={activeContext()?.transcript ?? []}>
              {(turn) => (
                <article class={`message message-${turn.role}`}>
                  <div class="message-meta">
                    <span>{turn.author}</span>
                    <time>{formatTimestamp(turn.timestamp)}</time>
                  </div>
                  <p>{turn.body}</p>
                </article>
              )}
            </For>
          </div>

          <footer class="composer-shell">
            <div class="composer-copy">
              <p class="eyebrow">Unified composer</p>
              <h3>Reply from anywhere. The system routes it.</h3>
            </div>

            <form
              class="composer-form"
              onSubmit={(event) => {
                event.preventDefault();
                inbox.submitDraft();
              }}
            >
              <textarea
                class="composer-input"
                name="prompt"
                placeholder={
                  pendingPrompt()?.prompt ??
                  "Type naturally. The system decides whether this continues, revives, answers, or starts."
                }
                rows={4}
                value={inbox.draft()}
                onInput={(event) => inbox.setDraft(event.currentTarget.value)}
              />

              <div class="composer-actions">
                <div class="suggestion-row">
                  <For each={demoPrompts}>
                    {(prompt) => (
                      <button
                        class="suggestion-chip"
                        type="button"
                        onClick={() => inbox.setDraft(prompt)}
                      >
                        {prompt}
                      </button>
                    )}
                  </For>
                </div>

                <button
                  class="submit-button"
                  disabled={!inbox.canSubmit()}
                  type="submit"
                >
                  Route message
                </button>
              </div>
            </form>
          </footer>
        </section>
      </main>
    </div>
  );
}

type SignalProps = {
  label: string;
  value: string;
};

function Signal(props: SignalProps) {
  return (
    <div class="signal-panel">
      <p>{props.label}</p>
      <strong>{props.value}</strong>
    </div>
  );
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
