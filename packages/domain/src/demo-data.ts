import { inboxStateSchema, type InboxState } from "./inbox";

const demoInboxState = {
  activeContextId: "gumzo-scaffold",
  nextContextNumber: 6,
  nextTurnNumber: 15,
  routeDecision: {
    strategy: "continue-active",
    confidence: 0.94,
    rationale:
      "Matched the active Gumzo workspace, recent product-planning language, and the open scaffolding task.",
    targetContextId: "gumzo-scaffold",
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
      transcript: [
        {
          id: "turn-1",
          role: "assistant",
          author: "Gumzo",
          body: "I mapped the onboarding flow, but I need one product call before I wire the auth stack.",
          timestamp: "2026-06-28T07:12:00.000Z",
        },
        {
          id: "turn-2",
          role: "assistant",
          author: "Gumzo",
          body: "Which provider should back sign-in for the first private alpha: passkeys, Google, or a custom email flow?",
          timestamp: "2026-06-28T07:18:00.000Z",
        },
      ],
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
      transcript: [
        {
          id: "turn-3",
          role: "user",
          author: "Michael",
          body: "Let’s turn the PRD into the first actual scaffold and keep the commits small and tasteful.",
          timestamp: "2026-06-28T08:38:00.000Z",
        },
        {
          id: "turn-4",
          role: "assistant",
          author: "Gumzo",
          body: "I’m starting with the repo boundary lines first: workspace conventions, domain contracts, and a web shell that makes the architecture visible before we wire runtime behavior.",
          timestamp: "2026-06-28T08:39:00.000Z",
        },
        {
          id: "turn-5",
          role: "assistant",
          author: "Gumzo",
          body: "The visible product will stay singular, but the code should preserve separate context state, pending input, and scope boundaries from day one.",
          timestamp: "2026-06-28T08:41:00.000Z",
        },
        {
          id: "turn-6",
          role: "assistant",
          author: "Gumzo",
          body: "This scaffold is intentionally static. Its job is to prove the shape of the system: a task rail, an active thread, and typed route decisions sitting above hidden contexts.",
          timestamp: "2026-06-28T08:43:00.000Z",
        },
      ],
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
      transcript: [
        {
          id: "turn-7",
          role: "assistant",
          author: "Gumzo",
          body: "I’ve started comparing context-routing products against the manual-session model most assistants still expose.",
          timestamp: "2026-06-28T06:44:00.000Z",
        },
        {
          id: "turn-8",
          role: "assistant",
          author: "Gumzo",
          body: "The main emerging pattern is that users want a single conversational inbox, but they still need a visible trail of what is blocked or running underneath.",
          timestamp: "2026-06-28T06:55:00.000Z",
        },
      ],
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
      transcript: [
        {
          id: "turn-9",
          role: "user",
          author: "Michael",
          body: "Let’s sketch a Kyoto and Tokyo split for October with enough slack for wandering days.",
          timestamp: "2026-06-27T17:48:00.000Z",
        },
        {
          id: "turn-10",
          role: "assistant",
          author: "Gumzo",
          body: "I drafted a first itinerary, but we still need to settle the hotel neighborhoods and whether the rail pass makes sense for the final shape.",
          timestamp: "2026-06-27T18:15:00.000Z",
        },
      ],
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
      transcript: [
        {
          id: "turn-11",
          role: "user",
          author: "Michael",
          body: "I want a letter that argues AI should feel like one continuous workspace instead of a folder full of chats.",
          timestamp: "2026-06-27T15:34:00.000Z",
        },
        {
          id: "turn-12",
          role: "assistant",
          author: "Gumzo",
          body: "I drafted the full letter and closed the loop with a stronger ending about interface responsibility moving from the human to the machine.",
          timestamp: "2026-06-27T16:12:00.000Z",
        },
      ],
    },
  ],
} satisfies InboxState;

export const sampleInboxState = inboxStateSchema.parse(demoInboxState);
