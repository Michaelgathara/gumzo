import {
  getChildContexts,
  getContextLineage,
  getContextStateLabel,
  getParentContext,
  getRouteStrategyLabel,
  getWaitingContexts,
  groupContextsByRailBucket,
  previewInboxRoute,
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
  const currentState = createMemo(() => inbox.inbox());
  const rail = createMemo(() =>
    groupContextsByRailBucket(currentState().contexts),
  );
  const activeContext = inbox.activeContext;
  const routeDecision = createMemo(() => inbox.inbox().routeDecision);
  const routeTarget = createMemo(() =>
    currentState().contexts.find(
      (context) => context.id === routeDecision().targetContextId,
    ),
  );
  const pendingPrompt = createMemo(() => activeContext()?.pendingItems[0]);
  const waitingContexts = createMemo(() => getWaitingContexts(currentState()));
  const branchedContextCount = createMemo(
    () =>
      currentState().contexts.filter((context) => context.parentContextId)
        .length,
  );
  const activeParent = createMemo(() => {
    const context = activeContext();

    return context ? getParentContext(currentState(), context.id) : undefined;
  });
  const activeChildren = createMemo(() => {
    const context = activeContext();

    return context ? getChildContexts(currentState(), context.id) : [];
  });
  const activeLineage = createMemo(() => {
    const context = activeContext();

    return context ? getContextLineage(currentState(), context.id) : [];
  });
  const activeRelationLabel = createMemo(() => {
    if (activeParent() && activeChildren().length > 0) {
      return "Branched context";
    }

    if (activeParent()) {
      return "Child context";
    }

    if (activeChildren().length > 0) {
      return "Root context";
    }

    return "Standalone context";
  });
  const draftRouteDecision = createMemo(() =>
    previewInboxRoute(inbox.inbox(), inbox.draft()),
  );
  const draftRouteTarget = createMemo(() => {
    const draftRoute = draftRouteDecision();

    if (!draftRoute || draftRoute.strategy === "start-new") {
      return undefined;
    }

    return inbox
      .inbox()
      .contexts.find((context) => context.id === draftRoute.targetContextId);
  });
  const draftRouteHeadline = createMemo(() => {
    const draftRoute = draftRouteDecision();

    if (!draftRoute) {
      return undefined;
    }

    if (draftRoute.strategy === "start-new") {
      return "Start new context";
    }

    return draftRouteTarget()
      ? `${getRouteStrategyLabel(draftRoute.strategy)} → ${draftRouteTarget()?.title}`
      : getRouteStrategyLabel(draftRoute.strategy);
  });
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
  const submitLabel = createMemo(() => {
    switch (draftRouteDecision()?.strategy) {
      case "answer-pending":
        return "Answer pending context";
      case "continue-active":
        return "Continue active context";
      case "manual-focus":
        return "Route message";
      case "revive-context":
        return "Revive earlier context";
      case "start-new":
        return "Start new context";
      default:
        return "Route message";
    }
  });

  return (
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-copy">
          <p class="eyebrow">Gumzo</p>
          <h1>Inbox</h1>
        </div>

        <div class="topbar-meta">
          <span class="meta-pill">{inbox.runtime.label}</span>
          <span class="meta-pill meta-pill-muted">{runtimeStatusLabel()}</span>
        </div>
      </header>

      <main class="workspace">
        <aside class="rail-stack">
          <section class="signal-card sidebar-intro">
            <p class="eyebrow">Unified Inbox</p>
            <h2>One visible conversation.</h2>
            <p>
              Context routing, memory, and execution stay in the background.
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
              <Signal
                label="Waiting"
                value={String(waitingContexts().length)}
              />
              <Signal label="Branches" value={String(branchedContextCount())} />
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
                        const parentContext = createMemo(() =>
                          getParentContext(currentState(), context.id),
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
                                  {parentContext() ? (
                                    <p class="context-relation">
                                      Branched from {parentContext()!.title}
                                    </p>
                                  ) : null}
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
          <div class="thread-column">
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

            <div class="thread-meta-grid">
              <section class="thread-meta-card">
                <div class="thread-meta-header">
                  <div>
                    <p class="eyebrow">Context graph</p>
                    <h3>{activeRelationLabel()}</h3>
                  </div>
                  <span class="context-badge">
                    {activeChildren().length} branch
                    {activeChildren().length === 1 ? "" : "es"}
                  </span>
                </div>

                <div class="lineage-trail">
                  <For each={activeLineage()}>
                    {(context) => (
                      <button
                        class="lineage-node"
                        classList={{
                          "lineage-node-active":
                            context.id === activeContext()?.id,
                        }}
                        type="button"
                        onClick={() => inbox.focusContext(context.id)}
                      >
                        {context.title}
                      </button>
                    )}
                  </For>
                </div>

                {activeChildren().length > 0 ? (
                  <div class="related-contexts">
                    <For each={activeChildren()}>
                      {(context) => (
                        <button
                          class="related-context-button"
                          type="button"
                          onClick={() => inbox.focusContext(context.id)}
                        >
                          {context.title}
                        </button>
                      )}
                    </For>
                  </div>
                ) : (
                  <p class="meta-copy">
                    {activeParent()
                      ? `This branch came from ${activeParent()!.title}.`
                      : "This context is currently standalone."}
                  </p>
                )}
              </section>

              <section class="thread-meta-card">
                <div class="thread-meta-header">
                  <div>
                    <p class="eyebrow">Waiting on you</p>
                    <h3>
                      {waitingContexts().length === 0
                        ? "No blocked contexts"
                        : `${waitingContexts().length} context${
                            waitingContexts().length === 1 ? "" : "s"
                          } need input`}
                    </h3>
                  </div>
                  <span class="context-badge context-badge-ghost">
                    {waitingContexts().length}
                  </span>
                </div>

                {waitingContexts().length > 0 ? (
                  <div class="pending-context-list">
                    <For each={waitingContexts().slice(0, 3)}>
                      {(context) => (
                        <button
                          class="pending-context-button"
                          type="button"
                          onClick={() => inbox.focusContext(context.id)}
                        >
                          <strong>{context.title}</strong>
                          <span>
                            {context.pendingItems[0]?.prompt ??
                              "Open question is waiting for a response."}
                          </span>
                        </button>
                      )}
                    </For>
                  </div>
                ) : (
                  <p class="meta-copy">
                    Nothing across the inbox is currently waiting for the user.
                  </p>
                )}
              </section>
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
              <p class="route-title">Route preview</p>
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
          </div>

          <footer class="composer-shell">
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
                  "Message Gumzo. The runtime decides whether this continues, revives, answers, or starts."
                }
                rows={4}
                value={inbox.draft()}
                onInput={(event) => inbox.setDraft(event.currentTarget.value)}
              />

              {draftRouteDecision() ? (
                <div class="composer-preview">
                  <div class="composer-preview-header">
                    <p class="route-title">{draftRouteHeadline()}</p>
                    <span class="context-badge context-badge-ghost">
                      {Math.round(draftRouteDecision()!.confidence * 100)}%
                    </span>
                  </div>
                  <p>{draftRouteDecision()!.rationale}</p>
                </div>
              ) : null}

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
                  {submitLabel()}
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
