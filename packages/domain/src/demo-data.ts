import { inboxViewModelSchema, type InboxViewModel } from "./inbox";

const demoInboxViewModel = {
  activeContextId: "gumzo-scaffold",
  routeLabel: "continue active",
  routeDecision: {
    strategy: "continue-active",
    confidence: 0.94,
    rationale:
      "Matched the active Gumzo workspace, recent product-planning language, and the open scaffolding task.",
  },
  contexts: [
    {
      id: "auth-provider",
      title: "Auth provider decision",
      summary:
        "Waiting for a choice between passkeys, Google, or a custom email flow before wiring onboarding.",
      state: "needs-input",
      updatedAt: "2026-06-28T07:18:00.000Z",
      pendingItems: [
        {
          id: "auth-provider-choice",
          type: "question",
          prompt:
            "Which provider should back sign-in for the first private alpha?",
        },
      ],
      scope: {
        workspace: "gumzo",
        tools: ["code", "docs"],
      },
    },
    {
      id: "gumzo-scaffold",
      title: "Unified inbox scaffold",
      summary:
        "Turning the PRD into the first real app shell and typed domain model.",
      state: "running",
      updatedAt: "2026-06-28T08:43:00.000Z",
      pendingItems: [],
      scope: {
        workspace: "gumzo",
        tools: ["code", "docs"],
      },
    },
    {
      id: "market-scan",
      title: "AI interface market scan",
      summary:
        "Comparing single-window conversational products against traditional multi-thread assistants.",
      state: "running",
      updatedAt: "2026-06-28T06:55:00.000Z",
      pendingItems: [],
      scope: {
        workspace: "research",
        tools: ["browser", "docs"],
      },
    },
    {
      id: "japan-trip",
      title: "Japan October trip",
      summary:
        "Half-finished itinerary with a few unresolved train and hotel decisions.",
      state: "idle",
      updatedAt: "2026-06-27T18:15:00.000Z",
      pendingItems: [],
      scope: {
        workspace: "personal",
        tools: ["browser"],
      },
    },
    {
      id: "founder-letter",
      title: "Founder letter draft",
      summary:
        "A completed narrative draft about why AI should feel like a continuous operating layer.",
      state: "done",
      updatedAt: "2026-06-27T16:12:00.000Z",
      pendingItems: [],
      scope: {
        workspace: "writing",
        tools: ["docs"],
      },
    },
  ],
  transcript: [
    {
      id: "turn-1",
      role: "user",
      author: "Michael",
      body: "Let’s turn the PRD into the first actual scaffold and keep the commits small and tasteful.",
      timestamp: "2026-06-28T08:38:00.000Z",
    },
    {
      id: "turn-2",
      role: "assistant",
      author: "Gumzo",
      body: "I’m starting with the repo boundary lines first: workspace conventions, domain contracts, and a web shell that makes the architecture visible before we wire runtime behavior.",
      timestamp: "2026-06-28T08:39:00.000Z",
    },
    {
      id: "turn-3",
      role: "assistant",
      author: "Gumzo",
      body: "The visible product will stay singular, but the code should preserve separate context state, pending input, and scope boundaries from day one.",
      timestamp: "2026-06-28T08:41:00.000Z",
    },
    {
      id: "turn-4",
      role: "assistant",
      author: "Gumzo",
      body: "This scaffold is intentionally static. Its job is to prove the shape of the system: a task rail, an active thread, and typed route decisions sitting above hidden contexts.",
      timestamp: "2026-06-28T08:43:00.000Z",
    },
  ],
} satisfies InboxViewModel;

export const sampleInboxViewModel =
  inboxViewModelSchema.parse(demoInboxViewModel);
