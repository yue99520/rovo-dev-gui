
// import * as fs from 'fs';
// import * as path from 'path';

// function findSession(sessionPath: string, matchGapTimeSeconds: number, timeoutSeconds: number): Promise<string> {
//   const currentTime = Date.now();
//   const timeoutMs = timeoutSeconds * 1000;
//   const startTime = Date.now();

//   return new Promise((resolve, reject) => {
//     const checkSessions = async () => {
//       try {
//         // Check if the session path exists
//         if (!fs.existsSync(sessionPath)) {
//           throw new Error(`Session path does not exist: ${sessionPath}`);
//         }

//         // Read all directories in the session path
//         const entries = fs.readdirSync(sessionPath, { withFileTypes: true });
//         const sessionDirs = entries.filter(entry => entry.isDirectory());

//         for (const sessionDir of sessionDirs) {
//           const sessionUuid = sessionDir.name;
//           const contextFilePath = path.join(sessionPath, sessionUuid, 'session_context.json');

//           // Check if session_context.json exists
//           if (fs.existsSync(contextFilePath)) {
//             try {
//               const contextContent = fs.readFileSync(contextFilePath, 'utf8');
//               const contextData = JSON.parse(contextContent);

//               // Check if timestamp exists and is within the gap time
//               if (typeof contextData.timestamp === 'number') {
//                 const timeDiff = Math.abs(currentTime - contextData.timestamp);
//                 if (timeDiff <= matchGapTimeSeconds * 1000) {
//                   resolve(sessionUuid);
//                   return;
//                 }
//               }
//             } catch (parseError) {
//               // Continue to next session if JSON parsing fails
//               console.warn(`Failed to parse session_context.json for session ${sessionUuid}:`, parseError);
//             }
//           }
//         }

//         // Check if timeout has been reached
//         if (Date.now() - startTime >= timeoutMs) {
//           reject(new Error(`Timeout: No matching session found within ${timeoutSeconds} seconds`));
//           return;
//         }

//         // If no session found yet and timeout not reached, try again after a short delay
//         setTimeout(checkSessions, 100);
//       } catch (error) {
//         reject(error);
//       }
//     };

//     // Start checking sessions
//     checkSessions();
//   });
// }

// export { findSession };

import * as vscode from 'vscode';

async function findSession(
  sessionPath: vscode.Uri,
  matchGapTimeSeconds: number,
  timeoutSeconds: number
): Promise<{
  sessionUUID: string;
  sessionContextPath: vscode.Uri;
}> {
  const timeoutMs = timeoutSeconds * 1000;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkSessions = async () => {
      try {
        // 確認 sessionPath 存在
        try {
          await vscode.workspace.fs.stat(sessionPath);
        } catch {
          throw new Error(`Session path does not exist: ${sessionPath.fsPath}`);
        }

        // 讀取 session 目錄下所有 entries
        const entries = await vscode.workspace.fs.readDirectory(sessionPath);
        const sessionDirs = entries.filter(([, type]) => type === vscode.FileType.Directory);

        const currentTime = Date.now();

        for (const [sessionUuid] of sessionDirs) {
          const contextFileDir = vscode.Uri.joinPath(sessionPath, sessionUuid);
          const contextDirEntries = await vscode.workspace.fs.readDirectory(contextFileDir);
          if (!contextDirEntries.find(([name, type]) => name === 'session_context.json' && type === vscode.FileType.File)) {
            continue;
          }
          const contextFileUri = vscode.Uri.joinPath(contextFileDir, 'session_context.json');
          try {
            const content = await vscode.workspace.fs.readFile(contextFileUri);
            const contextData = JSON.parse(new TextDecoder().decode(content));
            
            if (typeof contextData.timestamp === 'number') {
              const timeDiff = Math.abs(currentTime - contextData.timestamp * 1000);
              console.log('access: ', contextFileUri.fsPath, contextData.timestamp, timeDiff);
              if (timeDiff <= matchGapTimeSeconds * 1000) {
                console.log("find session UUID: ", sessionUuid);
                resolve({
                  sessionUUID: sessionUuid,
                  sessionContextPath: contextFileUri,
                });
                return;
              }
            }
          } catch (err) {
            // 檔案不存在或 parse error 時忽略
            console.warn(`Failed to parse session_context.json for session ${sessionUuid}:`, err);
          }
        }

        // 檢查 timeout
        if (Date.now() - startTime >= timeoutMs) {
          reject(new Error(`Timeout: No matching session found within ${timeoutSeconds} seconds`));
          return;
        }

        // 繼續輪詢
        setTimeout(checkSessions, 100);
      } catch (err) {
        reject(err);
      }
    };

    checkSessions();
  });
}

export { findSession };
