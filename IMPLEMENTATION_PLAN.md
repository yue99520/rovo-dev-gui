# VSCode Extension Implementation Plan: AI Chat Sidebar with CLI Backend

## 專案概述 (Project Overview)

建立一個 VSCode 擴展，提供側邊欄聊天介面，背後連接到互動式 CLI 工具。使用者在聊天視窗中輸入訊息，實際上是在與 CLI 工具進行互動。

## 開發風格
- 盡量關注點分離
- 接 CLI 的地方要稍微隔離，因為之後要處理轉化格式輸出的問題
- 不要太大一包 function 命名要名符其實
- 不用到太多註解
- 不能有任何 emoji 出現在 code 中


## 架構設計 (Architecture Design)

### 核心組件 (Core Components)

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Chat Sidebar  │ ◄──┤  Extension Host  │ ◄──┤   CLI Process   │
│   (WebView)     │    │   (Node.js)      │    │  (Child Process)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
        ▲                        ▲                        ▲
        │                        │                        │
        │                        │                        │
   ┌────▼────┐              ┌────▼────┐              ┌────▼────┐
   │ HTML/CSS│              │TypeScript│             │ Spawn   │
   │JavaScript│             │ Logic   │              │ Process │
   └─────────┘              └─────────┘              └─────────┘
```

### 技術堆疊 (Tech Stack)

1. **前端 (Frontend)**: HTML + CSS + JavaScript (在 WebView 中)
2. **後端 (Backend)**: TypeScript + Node.js child_process
3. **通訊 (Communication)**: VSCode WebView API + postMessage
4. **CLI 互動 (CLI Interaction)**: spawn/exec + stdin/stdout 處理

## 實作步驟 (Implementation Steps)

### Phase 1: 基礎架構 (Basic Infrastructure)

#### 1.1 更新 package.json 配置
```json
{
  "contributes": {
    "views": {
      "explorer": [
        {
          "id": "rovoChatView",
          "name": "Rovo AI Chat",
          "when": "workbenchState != empty"
        }
      ]
    },
    "commands": [
      {
        "command": "rovo-dev-gui.openChat",
        "title": "Open Rovo Chat",
        "icon": "$(comment-discussion)"
      }
    ],
    "menus": {
      "view/title": [
        {
          "command": "rovo-dev-gui.openChat",
          "when": "view == rovoChatView",
          "group": "navigation"
        }
      ]
    }
  }
}
```

#### 1.2 建立 TreeDataProvider
建立一個自定義的 TreeDataProvider 來管理側邊欄視圖。

#### 1.3 建立 WebView Panel
建立聊天介面的 WebView panel，包含：
- 訊息顯示區域
- 輸入框
- 發送按鈕（ctrl + enter 發送）
- 基本的 CSS 樣式

### Phase 2: CLI 程序管理 (CLI Process Management)

#### 2.1 CLI 程序包裝器 (CLI Process Wrapper)
```typescript
class CLIManager {
  private process: ChildProcess | null = null;
  private onOutput: (data: string) => void;
  private onError: (error: string) => void;

  constructor(onOutput: (data: string) => void, onError: (error: string) => void) {
    this.onOutput = onOutput;
    this.onError = onError;
  }

  start(command: string, args: string[]) {
    // 啟動 CLI 程序
  }

  sendInput(input: string) {
    // 發送輸入到 CLI
  }

  stop() {
    // 停止 CLI 程序
  }
}
```

#### 2.2 輸入輸出處理
- 監聽 stdout 和 stderr
- 處理 CLI 的提示符和回應
- 管理程序的生命週期

### Phase 3: 通訊機制 (Communication Layer)

#### 3.1 WebView 到 Extension 通訊
```javascript
// WebView 中的 JavaScript
const vscode = acquireVsCodeApi();

function sendMessage(text) {
  vscode.postMessage({
    type: 'chatMessage',
    text: text
  });
}
```

#### 3.2 Extension 到 WebView 通訊
```typescript
// Extension 中的 TypeScript
webviewPanel.webview.postMessage({
  type: 'cliResponse',
  data: response
});
```

#### 3.3 訊息類型定義
```typescript
interface ChatMessage {
  type: 'userMessage' | 'cliResponse' | 'error' | 'status';
  content: string;
  timestamp: number;
}
```

### Phase 4: 聊天介面實作 (Chat Interface Implementation)

#### 4.1 HTML 結構
```html
<div id="chat-container">
  <div id="messages-area">
    <!-- 訊息顯示區域 -->
  </div>
  <div id="input-area">
    <input type="text" id="message-input" placeholder="輸入訊息...">
    <button id="send-button">發送</button>
  </div>
</div>
```

#### 4.2 CSS 樣式
- 支援 VSCode 主題
- 響應式設計
- 訊息氣泡樣式
- 載入狀態指示器

#### 4.3 JavaScript 邏輯
- 訊息發送處理
- 動態訊息顯示
- 自動滾動到底部
- 輸入歷史記錄

### Phase 5: 錯誤處理與狀態管理 (Error Handling & State Management)

#### 5.1 CLI 程序狀態監控
- 程序是否運行
- 連接狀態檢查
- 自動重連機制

#### 5.2 錯誤處理策略
- CLI 程序崩潰處理
- 網路連接問題
- 輸入驗證
- 使用者友好的錯誤訊息

#### 5.3 狀態持久化
- 聊天歷史記錄
- CLI 配置設定
- 使用者偏好設定

## 檔案結構 (File Structure)

```
src/
├── extension.ts              # 主要擴展入口點
├── chatProvider.ts           # 聊天視圖提供者
├── cliManager.ts            # CLI 程序管理器
├── webviewContent.ts        # WebView HTML 內容
├── types.ts                 # TypeScript 類型定義
└── utils/
    ├── messageHandler.ts    # 訊息處理工具
    └── cliUtils.ts         # CLI 相關工具函數

resources/
├── chat.html               # 聊天介面 HTML
├── chat.css                # 聊天介面樣式
└── chat.js                 # 聊天介面邏輯
```

## 關鍵挑戰與解決方案 (Key Challenges & Solutions)

### 1. 互動式 CLI 處理
**挑戰**: CLI 工具可能有複雜的提示符和狀態
**解決方案**: 
- 使用 pty (pseudo-terminal) 而不是標準的 spawn
- 實作狀態機來追蹤 CLI 狀態
- 緩衝輸出直到檢測到完整回應

### 2. 即時通訊
**挑戰**: 需要即時顯示 CLI 輸出
**解決方案**:
- 使用 stream 處理而不是等待完整輸出
- 實作訊息佇列機制
- 使用 WebView postMessage API 進行即時通訊

### 3. 格式化輸出
**挑戰**: CLI 輸出可能包含 ANSI 顏色代碼和特殊字符
**解決方案** (後續階段):
- 使用 ansi-to-html 庫轉換顏色代碼
- 實作自定義解析器處理特殊格式
- 提供純文字和格式化兩種顯示模式

## 測試策略 (Testing Strategy)

### 單元測試
- CLI 管理器功能測試
- 訊息處理邏輯測試
- 錯誤處理機制測試

### 整合測試
- WebView 與 Extension 通訊測試
- CLI 程序生命週期測試
- 端到端聊天流程測試

### 手動測試
- 不同 CLI 工具相容性測試
- 使用者介面互動測試
- 效能和記憶體使用測試

## 未來增強功能 (Future Enhancements)

1. **多 CLI 支援**: 同時管理多個 CLI 會話
2. **格式化改進**: 完整的 ANSI 顏色和格式支援
3. **會話管理**: 儲存和載入聊天會話
4. **自動完成**: 基於 CLI 命令的智能建議
5. **主題支援**: 自定義聊天介面主題
6. **外掛系統**: 支援自定義 CLI 適配器

## 開始實作 (Getting Started)

建議從 Phase 1 開始，逐步實作每個階段。每個階段完成後進行測試，確保基礎功能正常運作後再進入下一階段。

這樣的分階段方法可以確保：
1. 早期發現和解決問題
2. 逐步建立複雜功能
3. 保持代碼的可維護性
4. 便於除錯和測試