import {
  getContextStateLabel,
  groupContextsByRailBucket,
  sampleInboxViewModel,
  type RailBucketKey,
} from "@gumzo/domain";
import { For, createMemo } from "solid-js";

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

export function App() {
  const rail = createMemo(() =>
    groupContextsByRailBucket(sampleInboxViewModel.contexts),
  );
  const activeContext = createMemo(() =>
    sampleInboxViewModel.contexts.find(
      (context) => context.id === sampleInboxViewModel.activeContextId,
    ),
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
          <span class="meta-pill">OpenCode-aligned runtime</span>
          <span class="meta-pill meta-pill-muted">Scaffold slice 01</span>
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
                label="Route strategy"
                value={sampleInboxViewModel.routeDecision.strategy.replaceAll(
                  "-",
                  " ",
                )}
              />
              <Signal
                label="Confidence"
                value={`${Math.round(sampleInboxViewModel.routeDecision.confidence * 100)}%`}
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
                      {(context) => (
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
                      )}
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
            </div>
            <div class="header-badges">
              <span class="context-badge">
                {getContextStateLabel(activeContext()?.state ?? "idle")}
              </span>
              <span class="context-badge context-badge-ghost">
                {sampleInboxViewModel.routeLabel}
              </span>
            </div>
          </div>

          <div class="route-callout">
            <p class="route-title">Routed from the inbox</p>
            <p>{sampleInboxViewModel.routeDecision.rationale}</p>
          </div>

          <div class="transcript">
            <For each={sampleInboxViewModel.transcript}>
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

            <div class="composer-frame" aria-hidden="true">
              <span class="composer-placeholder">
                Use OpenCode as the runtime, but keep the user in one window.
              </span>
              <button type="button">Route intelligently</button>
            </div>
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
