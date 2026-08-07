export type MessageRole = "user" | "assistant" | "system";

export type MessageStatus = "sent" | "streaming" | "error";

export type ThinkingBlock = {
  content: string;
  isCollapsed?: boolean;
};

export type MessageModelInfo = {
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
};

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  reasoning?: ThinkingBlock;
  status?: MessageStatus;
  error?: string;
  editedAt?: Date;
  createdAt: Date;
  model?: MessageModelInfo;
  thinkingLevel?: string;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: Date;
  createdAt: Date;
};
