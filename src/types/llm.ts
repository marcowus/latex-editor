export type LLMActionType =
  | 'write_editor'
  | 'insert_code'
  | 'create_file'
  | 'update_file'
  | 'delete_file'
  | 'switch_file';

export interface LLMAction {
  type: LLMActionType;
  target?: string; // 'active' or file path such as 'sections/method.tex'
  content?: string;
  mode?: 'replace' | 'insert' | 'append';
  description?: string;
  applied?: boolean;
}

export interface LLMMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  actions?: LLMAction[];
  model?: string;
  status?: 'success' | 'error' | 'pending' | 'offline_fallback';
}

export interface LLMProviderInfo {
  id: string;
  name: string;
  configured: boolean;
  models: string[];
}

export interface LLMStatus {
  configured: boolean;
  provider: string;
  model: string;
  providers?: LLMProviderInfo[];
  supportedActions: string[];
  documentationUrl?: string;
}
