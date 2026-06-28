export type OpenCodeSessionID = string;

export type OpenCodeDelivery = "queue" | "steer";

export type OpenCodeSessionStatus =
  | {
      type: "idle";
    }
  | {
      type: "busy";
    }
  | {
      type: "retry";
      attempt: number;
      message: string;
      next: number;
      action?: {
        label: string;
        link?: string;
        message: string;
        provider: string;
        reason: string;
        title: string;
      };
    };

export type OpenCodeTodoStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export type OpenCodeTodoPriority = "high" | "medium" | "low";

export type OpenCodeTodo = {
  content: string;
  priority: OpenCodeTodoPriority;
  status: OpenCodeTodoStatus;
};

export type OpenCodeSessionInfo = {
  id: OpenCodeSessionID;
  parentID?: OpenCodeSessionID;
  title: string;
  time: {
    archived?: string;
    created: string;
    updated: string;
  };
  location?: {
    directory?: string;
    workspaceID?: string;
  };
  subpath?: string;
};

export type OpenCodePrompt = {
  text: string;
  files?: Array<{
    description?: string;
    name?: string;
    uri: string;
  }>;
};

export type OpenCodePromptCommand = {
  delivery?: OpenCodeDelivery;
  prompt: OpenCodePrompt;
  resume?: boolean;
  sessionID: OpenCodeSessionID;
};

export type OpenCodeSessionCreateCommand = {
  agent?: string;
  id?: OpenCodeSessionID;
  location?: OpenCodeSessionInfo["location"];
  model?: string;
  subpath?: string;
};

export type OpenCodePromptAdmission = {
  admittedSeq: number;
  id: string;
  sessionID: OpenCodeSessionID;
  timeCreated: string;
};

export type OpenCodeUserMessage = {
  id: string;
  text: string;
  time: {
    created: string;
  };
  type: "user";
};

export type OpenCodeSystemMessage = {
  id: string;
  text: string;
  time: {
    created: string;
  };
  type: "system";
};

export type OpenCodeSyntheticMessage = {
  id: string;
  text: string;
  time: {
    created: string;
  };
  type: "synthetic";
};

export type OpenCodeShellMessage = {
  callID: string;
  command: string;
  id: string;
  output: string;
  time: {
    completed?: string;
    created: string;
  };
  type: "shell";
};

export type OpenCodeAssistantContent =
  | {
      id: string;
      text: string;
      type: "text";
    }
  | {
      id: string;
      text: string;
      type: "reasoning";
    }
  | {
      id: string;
      name: string;
      state: {
        status: "completed" | "error" | "pending" | "running";
      };
      type: "tool";
    };

export type OpenCodeAssistantMessage = {
  agent: string;
  content: OpenCodeAssistantContent[];
  error?: {
    message: string;
    type: "unknown";
  };
  finish?: string;
  id: string;
  time: {
    completed?: string;
    created: string;
  };
  type: "assistant";
};

export type OpenCodeCompactionMessage = {
  id: string;
  reason: "auto" | "manual";
  recent: string;
  summary: string;
  time: {
    created: string;
  };
  type: "compaction";
};

export type OpenCodeSessionMessage =
  | OpenCodeAssistantMessage
  | OpenCodeCompactionMessage
  | OpenCodeShellMessage
  | OpenCodeSyntheticMessage
  | OpenCodeSystemMessage
  | OpenCodeUserMessage;

export type OpenCodeDurableEventType =
  | "session.next.compaction.ended"
  | "session.next.context.updated"
  | "session.next.prompt.admitted"
  | "session.next.prompted"
  | "session.next.reasoning.ended"
  | "session.next.step.ended"
  | "session.next.step.failed"
  | "session.next.step.started"
  | "session.next.synthetic"
  | "session.next.text.ended"
  | "session.next.tool.called"
  | "session.next.tool.failed"
  | "session.next.tool.success";

export type OpenCodeDurableEvent = {
  sessionID: OpenCodeSessionID;
  timestamp: string;
  type: OpenCodeDurableEventType;
};

export type OpenCodeSessionRecord = {
  info: OpenCodeSessionInfo;
  messages: OpenCodeSessionMessage[];
  status: OpenCodeSessionStatus;
  todos: OpenCodeTodo[];
};

export type OpenCodeHydration = {
  sessions: OpenCodeSessionRecord[];
};

export type OpenCodeAdapterEvent =
  | {
      type: "server.connected";
    }
  | {
      session: OpenCodeSessionRecord;
      type: "session.created";
    }
  | {
      session: OpenCodeSessionRecord;
      type: "session.updated";
    }
  | {
      sessionID: OpenCodeSessionID;
      type: "session.deleted";
    }
  | {
      sessionID: OpenCodeSessionID;
      status: OpenCodeSessionStatus;
      type: "session.status";
    }
  | {
      event: OpenCodeDurableEvent;
      sessionID: OpenCodeSessionID;
      type: "session.durable";
    }
  | {
      sessionID: OpenCodeSessionID;
      todos: OpenCodeTodo[];
      type: "todo.updated";
    };

export interface OpenCodeSessionAdapter {
  compact(sessionID: OpenCodeSessionID): Promise<void>;
  createSession(
    command?: OpenCodeSessionCreateCommand,
  ): Promise<OpenCodeSessionRecord>;
  hydrate(): Promise<OpenCodeHydration>;
  interrupt(sessionID: OpenCodeSessionID): Promise<void>;
  prompt(
    command: OpenCodePromptCommand,
  ): Promise<OpenCodePromptAdmission | void>;
  readSession(sessionID: OpenCodeSessionID): Promise<OpenCodeSessionRecord>;
  subscribe(
    listener: (event: OpenCodeAdapterEvent) => void | Promise<void>,
  ): Promise<() => void> | (() => void);
  wait(sessionID: OpenCodeSessionID): Promise<void>;
}
