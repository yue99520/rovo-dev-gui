# Node.js Child Process 事件完整參考

## 📋 總覽

Node.js 的 `child_process` 包含多種流和程序本身的事件，了解這些事件對於穩健的 CLI 整合至關重要。

## 🔄 Stdout/Stderr 流事件 (Readable Stream)

### 核心事件：

| 事件名稱 | 觸發時機 | 參數 | 用途 |
|---------|---------|------|------|
| `data` | 有新數據可讀時 | `Buffer \| string` | **最重要** - 接收 CLI 輸出 |
| `end` | 流結束時 (EOF) | 無 | 檢測流是否正常結束 |
| `close` | 流關閉時 | 無 | 確認資源已釋放 |
| `error` | 流發生錯誤時 | `Error` | 處理流層級的錯誤 |

### 流控制事件：

| 事件名稱 | 觸發時機 | 用途 |
|---------|---------|------|
| `pause` | 流被暫停時 | 調試流控制問題 |
| `resume` | 流恢復時 | 調試流控制問題 |
| `readable` | 有數據可讀時 | 手動讀取模式 (很少用) |

## 🖥️ 程序本身事件 (ChildProcess)

### 生命週期事件：

| 事件名稱 | 觸發時機 | 參數 | 用途 |
|---------|---------|------|------|
| `spawn` | 程序成功啟動時 | 無 | 確認程序已啟動 |
| `exit` | 程序退出時 | `code, signal` | **關鍵** - 處理程序結束 |
| `close` | 所有 stdio 流關閉後 | `code, signal` | 確認完全關閉 |
| `error` | 程序啟動失敗時 | `Error` | **重要** - 處理啟動錯誤 |

### 通訊事件：

| 事件名稱 | 觸發時機 | 參數 | 用途 |
|---------|---------|------|------|
| `message` | 收到 IPC 消息時 | `any` | 進程間通訊 (需要 `stdio: 'ipc'`) |
| `disconnect` | IPC 通道斷開時 | 無 | IPC 連接管理 |

## 💡 實際應用場景

### 1. 基本 CLI 互動 (必須的)
```typescript
process.stdout?.on('data', (data) => {
    // 處理 CLI 輸出 - 核心功能
});

process.stderr?.on('data', (data) => {
    // 處理錯誤輸出 - 必要
});

process.on('exit', (code, signal) => {
    // 處理程序結束 - 必要
});

process.on('error', (error) => {
    // 處理啟動錯誤 - 必要
});
```

### 2. 調試和監控 (可選的)
```typescript
process.stdout?.on('end', () => {
    // 調試：stdout 流結束
});

process.on('close', (code, signal) => {
    // 確保所有資源已釋放
});
```

### 3. 錯誤檢測 (建議的)
```typescript
process.stdout?.on('error', (error) => {
    // 檢測 stdout 流錯誤
});

process.stderr?.on('error', (error) => {
    // 檢測 stderr 流錯誤
});
```

## 🚨 常見錯誤碼

### Error.code 值：
- `ENOENT` - 命令不存在
- `EACCES` - 權限不足
- `EPERM` - 操作不允許

### Exit codes：
- `0` - 正常退出
- `1` - 一般錯誤
- `130` - 被 Ctrl+C 中斷
- `null` - 被信號殺死

## 🎯 最佳實踐

### 1. 優先級排序：
1. **必須監聽**: `data`, `exit`, `error`
2. **建議監聽**: `end`, `close`, stream errors
3. **調試用**: `pause`, `resume`, `readable`

### 2. 錯誤處理策略：
```typescript
// 區分不同類型的錯誤
process.on('error', (error) => {
    if (error.code === 'ENOENT') {
        // 命令不存在 - 用戶友好的錯誤消息
    } else {
        // 其他錯誤 - 技術性錯誤消息
    }
});
```

### 3. 資源清理：
```typescript
process.on('exit', () => {
    // 清理緩衝區、重置狀態
});

process.on('close', () => {
    // 確認所有資源已釋放
});
```

## 📊 事件順序

典型的事件觸發順序：
1. `spawn` (成功啟動)
2. `data` events (持續的數據流)
3. `end` (數據流結束)
4. `exit` (程序退出)
5. `close` (所有流關閉)

失敗的順序：
1. `error` (啟動失敗) **或**
2. `data` → `error` (運行中錯誤) → `exit`

這個參考應該涵蓋了所有你需要知道的 CLI 進程事件！