import * as vscode from 'vscode';
import * as os from 'os';
import { IPty, spawn } from '@lydell/node-pty';
import { formatOutput } from './outputFormatter';
import { findSession } from './findSession';
import { InternalMessage, SessionReader, SessionReaderImpl } from './sessionReader';

export interface CLIManagerEvents {
    onOutput: (data: string) => void;
    onError: (error: string) => void;
    onStatusChange: (status: CLIStatus) => void;
    onModelUsageChange: (usage: ModelUsage) => void;
}

export enum CLIStatus {
    NOT_STARTED = 'Not Started',
    STARTING = 'Starting...',
    INTERACTIVE_MODE = 'Interactive Mode',
    BUSY = 'Processing...',
    ERROR = 'Error',
    STOPPED = 'Stopped'
}

export interface ModelUsage {
    session_context_string?: string;
    token_usage_string?: string;
    current_model?: string;
}

export class CLIManager {
    private ptyProcess: IPty | null = null;
    private status: CLIStatus = CLIStatus.NOT_STARTED;
    private events: CLIManagerEvents;
    private sessionReader?: SessionReader;

    constructor(events: CLIManagerEvents) {
        this.events = events;
    }

    /**
     * 啟動互動式 CLI 程序: acli rovodev run
     */
    public async start(): Promise<boolean> {
        if (this.ptyProcess) {
            console.log('CLI process already running');
            return true;
        }

        try {
            this.setStatus(CLIStatus.STARTING);

            // 取得當前工作區的根目錄
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : process.cwd();

            console.log('Starting CLI in directory:', cwd);

            // 使用 node-pty 創建 pseudo-terminal
            this.ptyProcess = spawn('acli', ['rovodev', 'run'], {
                name: 'xterm-color',
                cols: 100,
                rows: 100,
                cwd: cwd,
                encoding: null,
                // env: process.env
                env: {
                    ...process.env,
                    FORCE_COLOR: '0',
                    NO_COLOR: '1',
                },
            });


            this.setupProcessHandlers();

            console.log('CLI PTY process started with PID:', this.ptyProcess.pid);
            return true;

        } catch (error) {
            console.error('Failed to start CLI process:', error);
            this.setStatus(CLIStatus.ERROR);
            this.events.onError(`Failed to start CLI: ${error}`);
            return false;
        }
    }

    /**
     * 發送訊息到互動式 CLI
     */
    public sendMessage(message: string): boolean {
        if (!this.ptyProcess) {
            console.error('CLI PTY process not available for input');
            return false;
        }

        try {
            const utf8Message = Buffer.from(message + '\r', 'utf8').toString();
            this.ptyProcess.write(utf8Message);
            console.log('Message sent to PTY (using \\r)');
            if (!this.sessionReader) {
                // findSession('~/.rovodev/sessions', 20, 20)
                const home = vscode.Uri.file(os.homedir());
                const sessionRoot = vscode.Uri.joinPath(home, '.rovodev', 'sessions');
                findSession(sessionRoot, 120, 120)
                    .then(({sessionUUID, sessionContextPath}) => {
                        console.log('Session UUID:', sessionUUID);
                        this.sessionReader = new SessionReaderImpl(sessionUUID, sessionContextPath);
                        this.sessionReader.onMessages((messages: InternalMessage[]) => {
                            messages.forEach(message => this.events.onOutput(message.content));
                        });
                        return this.sessionReader.start();
                    })
                    .then(() => {
                        console.log('session reader stopped.');
                    });
            }
            return true;
        } catch (error) {
            console.error('Failed to send message to CLI:', error);
            this.events.onError(`Failed to send message: ${error}`);
            return false;
        }
    }

    /**
     * 停止 CLI 程序
     */
    public async stop(): Promise<Boolean> {
        return new Promise<Boolean>((resolve) => {
            if (this.ptyProcess) {
                console.log('Stopping CLI PTY process...');

                try {
                    // PTY 的 kill 方法
                    this.ptyProcess.kill();
                    this.ptyProcess = null;
                    console.log('CLI PTY process terminated');
                    resolve(true);
                } catch (error) {
                    console.error('Error stopping PTY process:', error);
                    this.ptyProcess = null;
                    resolve(false);
                }
            } else {
                resolve(true);
            }
        });
    }

    /**
     * 獲取當前狀態
     */
    public getStatus(): CLIStatus {
        return this.status;
    }

    /**
     * 檢查 CLI 程序是否正在運行
     */
    public isRunning(): boolean {
        return this.ptyProcess !== null;
    }
    /**
     * 設置程序事件處理器
     */
    private setupProcessHandlers(): void {
        if (!this.ptyProcess) {
            return;
        }
        // PTY 統一的數據處理 (包含 stdout + stderr)
        this.ptyProcess.onData((data: string) => {
            const newContent = data.toString();
            // 檢查是否進入互動模式
            this.checkForInteractiveMode(newContent);
            if (this.handleModelUsage(newContent)) {
                return;
            }
        });

        // 處理程序退出
        this.ptyProcess.onExit(async (exitCode) => {
            console.log(`CLI PTY process exited with code: ${exitCode.exitCode}, signal: ${exitCode.signal}`);

            if (exitCode.exitCode === 0) {
                console.log('CLI PTY process exited normally');
            } else {
                console.log(`CLI PTY process exited with error code: ${exitCode.exitCode}`);
            }

            this.setStatus(CLIStatus.STOPPED);
            this.ptyProcess = null;
            await this.sessionReader?.stop();
            this.sessionReader = undefined;
        });
    }

    private handleModelUsage(output: string): boolean {
        if (output.startsWith('Session context:')) {
            const startIndexOfSessionContext = output.indexOf('▮') + 2;
            this.events.onModelUsageChange({
                session_context_string: output.substring(startIndexOfSessionContext),
            });
            return true;
        }
        if (output.startsWith('Daily total:')) {
            const startIndexOfDailyTotal = output.indexOf('▮') + 2;
            this.events.onModelUsageChange({
                token_usage_string: output.substring(startIndexOfDailyTotal),
            });
            return true;
        }
        if (output.startsWith('Using model:')) {
            const startIndexOfModelName = 'Using model:'.length - 1;
            this.events.onModelUsageChange({
                current_model: output.substring(startIndexOfModelName),
            });
            return true;
        }
        return false;
    }

    /**
     * 檢查輸出是否表示進入了互動模式
     */
    private checkForInteractiveMode(output: string): void {
        // 常見的互動模式指示符
        const interactiveModeIndicators = [
            'Using model:',
        ];

        const lowerOutput = output.toLowerCase();
        const hasInteractiveIndicator = interactiveModeIndicators.some(indicator =>
            lowerOutput.includes(indicator.toLowerCase())
        );

        if (hasInteractiveIndicator && this.status !== CLIStatus.INTERACTIVE_MODE) {
            console.log('Detected interactive mode');
            this.setStatus(CLIStatus.INTERACTIVE_MODE);
        }
    }

    // /**
    //  * 處理增量輸出，避免重複內容
    //  */
    // private processIncrementalOutput(data: string): string | null {
    //     // 將新數據加到螢幕緩衝區
    //     this.screenBuffer += data;

    //     // 創建當前輸出的唯一識別符
    //     const crypto = require('crypto');
    //     const currentHash = crypto.createHash('md5').update(this.screenBuffer).digest('hex');

    //     // 如果與上次相同，跳過
    //     if (currentHash === this.lastOutputHash) {
    //         console.log('Duplicate output detected, skipping...');
    //         return null;
    //     }

    //     // 處理 ANSI 轉義序列和游標控制
    //     const cleanedData = this.cleanAnsiAndExtractContent(data);
    //     if (!cleanedData.trim()) {
    //         return null;
    //     }

    //     // 檢查是否是完整的訊息
    //     const completeMessage = this.extractCompleteMessage(this.screenBuffer);
    //     if (completeMessage && completeMessage !== this.lastCompleteMessage) {
    //         console.log('New complete message detected:', JSON.stringify(completeMessage));
    //         this.lastCompleteMessage = completeMessage;
    //         this.lastOutputHash = currentHash;

    //         // 清理螢幕緩衝區，保留最後的狀態
    //         this.screenBuffer = this.screenBuffer.slice(-1000); // 保留最後 1000 字符

    //         return completeMessage;
    //     }

    //     // 如果不是完整訊息，檢查是否有新的增量內容
    //     const incrementalContent = this.extractIncrementalContent(cleanedData);
    //     if (incrementalContent) {
    //         this.lastOutputHash = currentHash;
    //         return incrementalContent;
    //     }

    //     return null;
    // }

    // /**
    //  * 清理 ANSI 轉義序列並提取純文本內容
    //  */
    // private cleanAnsiAndExtractContent(data: string): string {
    //     return data.replace(this.ansiRegex(), '');
    //     // // 移除常見的 ANSI 轉義序列
    //     // const ansiRegex = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
    //     // let cleaned = data.replace(ansiRegex, '');

    //     // // 移除游標控制字符
    //     // cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    //     // // 移除多餘的控制字符
    //     // cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    //     // return cleaned;
    // }

    // private ansiRegex({onlyFirst = false} = {}) {
    //     // Valid string terminator sequences are BEL, ESC\, and 0x9c
    //     const ST = '(?:\\u0007|\\u001B\\u005C|\\u009C)';

    //     // OSC sequences only: ESC ] ... ST (non-greedy until the first ST)
    //     const osc = `(?:\\u001B\\][\\s\\S]*?${ST})`;

    //     // CSI and related: ESC/C1, optional intermediates, optional params (supports ; and :) then final byte
    //     const csi = '[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:[;:]\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]';

    //     const pattern = `${osc}|${csi}`;

    //     return new RegExp(pattern, onlyFirst ? undefined : 'g');
    // }

    // /**
    //  * 嘗試提取完整的訊息（例如等待提示符出現）
    //  */
    // private extractCompleteMessage(buffer: string): string | null {
    //     const cleaned = this.cleanAnsiAndExtractContent(buffer);

    //     // 常見的完整訊息指示符
    //     const completionIndicators = [
    //         /.*\n\s*$/,  // 以換行和空白結尾
    //         /.*[>$#]\s*$/,  // 以命令提示符結尾
    //         /.*\?\s*$/,  // 以問號結尾（問題）
    //         /.*[。！？]\s*$/,  // 以標點符號結尾`
    //         /.*╯\s*$/,  // 以 box 字符結尾`
    //         /.*Uses AI. Verify results.\s*$/,  // 以 box 字符結尾
    //     ];

    //     for (const indicator of completionIndicators) {
    //         const match = cleaned.match(indicator);
    //         if (match) {
    //             return match[0].trim();
    //         }
    //     }

    //     return null;
    // }

    // /**
    //  * 提取增量內容（新增的部分）
    //  */
    // private extractIncrementalContent(data: string): string | null {
    //     // 如果數據很短且只包含控制字符，跳過
    //     if (data.length < 3 && !/[a-zA-Z0-9\u4e00-\u9fff]/.test(data)) {
    //         return null;
    //     }

    //     // 如果包含有意義的文字內容，返回
    //     const meaningfulContent = data.match(/[a-zA-Z0-9\u4e00-\u9fff\s\p{P}]+/u);
    //     if (meaningfulContent && meaningfulContent[0].trim().length > 0) {
    //         return meaningfulContent[0].trim();
    //     }

    //     return null;
    // }

    /**
     * 設置狀態並通知
     */
    private setStatus(newStatus: CLIStatus): void {
        if (this.status !== newStatus) {
            console.log(`CLI status changed: ${this.status} -> ${newStatus}`);
            this.status = newStatus;
            this.events.onStatusChange(newStatus);
        }
    }

    /**
     * 清理資源
     */
    public dispose(): void {
        this.stop();
    }
}