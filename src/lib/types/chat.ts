export type MessageRole = "user" | "assistant" | "system";

export type MessageStatus = "sent" | "streaming" | "error";

export type ThinkingBlock = {
  content: string;
  isCollapsed?: boolean;
};

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  reasoning?: ThinkingBlock;
  status?: MessageStatus;
  editedAt?: Date;
  createdAt: Date;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: Date;
  createdAt: Date;
};
