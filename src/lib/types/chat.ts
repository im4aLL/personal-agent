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

export type Attachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  data?: string;
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
  attachments?: Attachment[];
};

export type ConversationSummary = Omit<Conversation, "messages">;

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  pinned: boolean;
  tags: string[];
  updatedAt: Date;
  createdAt: Date;
};

export type UserInstruction = {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Skill = {
  id: string;
  name: string;
  description: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomAgent = {
  id: string;
  name: string;
  description: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};
