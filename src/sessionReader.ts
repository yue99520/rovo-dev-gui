
import * as vscode from 'vscode';

interface UsageModel {
  request_tokens: number;
  response_tokens: number;
  total_tokens: number;
}

interface Part {
  content?: string;
  part_kind: string;
}

interface MessageHistory {
  parts: Part[];
  kind: "request" | "response";
  timestamp?: number;
}

interface SessionContext {
  message_history: MessageHistory[];
  usage: UsageModel;
  timestamp: number;
  initial_prompt: string;
  prompts: string[];
  latest_result: string;
  workspace_path: string;
  log_dir: string;
  artifacts: {
    memory: string;
  }
}

export interface InternalMessage {
  content: string;
  timestamp?: number;
}

export interface SessionReader {
  getUsage(): Promise<UsageModel>;
  initialPrompt(): Promise<string>;
  latestResult(): Promise<string>;
  start(): void;
  stop(): Promise<void>;
  onMessages(callback: (messages: InternalMessage[]) => void): void;
}

export class SessionReaderImpl implements SessionReader {
  private lastMessageLength = 0;
  private lastMessageTimestamp = 0;
  private listeners: Array<(messages: InternalMessage[]) => void> = [];
  private timer?: NodeJS.Timeout;
  private stopResolve?: () => void;
  private startPromise?: Promise<void>;
  private running = false;

  constructor(private session: string, private contextPath: vscode.Uri) {
    console.log(`Session reader: ${session}`);
  }

  async getUsage(): Promise<UsageModel> {
    const json = await this.readSession();
    return json.usage;
  }
  async initialPrompt(): Promise<string> {
    const json = await this.readSession();
    return json.initial_prompt;
  }
  async latestResult(): Promise<string> {
    const json = await this.readSession();
    return json.latest_result;
  }

  async start(): Promise<void> {
    if (this.running) {
      return this.startPromise ?? Promise.resolve();
    };
    this.running = true;

    const runner = async () => {
      if (!this.running) {
        return;
      }
      try {
        const session = await this.readSession();
        const messages = this.pullResponseMessages(session);
        if (messages.length > 0) {
          this.listeners.forEach(fn => fn(messages));
        }
      } catch (e) {
        console.error(e);
      }
    };

    this.startPromise = new Promise<void>(resolve => {
      this.stopResolve = resolve;
    });

    // 先跑一次，再每秒輪詢
    await runner();
    this.timer = setInterval(runner, 1000);

    return this.startPromise;
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    // 讓 start() 的 Promise 完成
    this.stopResolve?.();
    this.stopResolve = undefined;

    // 重置引用，避免之後 start() 取得舊的 promise
    this.startPromise = undefined;
  }

  onMessages(callback: (messages: InternalMessage[]) => void): void {
    this.listeners.push(callback);
  }

  private pullResponseMessages(context: SessionContext): InternalMessage[] {
    if (this.lastMessageLength === context.message_history.length) {
      return [];
    }
    this.lastMessageLength = context.message_history.length;

    const responses = context.message_history.filter(messageHistory => messageHistory.kind === 'response');
    const messages: InternalMessage[] = [];
    for (const response of responses) {
      const timestamp = response.timestamp ? new Date(response.timestamp).getTime() : undefined;
      if (!timestamp) {
        continue;
      }
      if (timestamp <= this.lastMessageTimestamp) {
        continue;
      }
      this.lastMessageTimestamp = timestamp;
      response.parts
        .filter(part => part.part_kind === 'text' && part.content)
        .map(part => part.content)
        .forEach(part => {
          if (!part) {
            return;
          }
          messages.push({
            content: part,
            timestamp: timestamp,
          });
        });
    }
    return messages;
  }

  private async readSession(): Promise<SessionContext> {
    const content = await vscode.workspace.fs.readFile(this.contextPath);
    const contextData = JSON.parse(new TextDecoder().decode(content));
    return contextData;
  }
}