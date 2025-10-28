export interface StringStringKeyValuePair {
  key?: string;
  value?: string;
}

export interface Ask {
  input: string;
  attachment?: string;
  userName: string;
  userId?: string;
  agentId?: string;
  messageType?: string;
  variables?: StringStringKeyValuePair[];
  feePayer: string;
}

export interface ChatRequest {
  input: string;
  variables?: StringStringKeyValuePair[];
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  [k: string]: unknown;
}
