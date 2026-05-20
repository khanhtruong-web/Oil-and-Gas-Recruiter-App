import { syncToGoogleSheets } from './sheetService';
import { googleManager } from './GoogleWorkspaceManager';

export interface PendingSyncTask {
  id: string;
  type: 'SHEET_SYNC';
  payload: any;
  timestamp: number;
}

const QUEUE_KEY = 'cv_offline_sync_queue';

export function getSyncQueue(): PendingSyncTask[] {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addToSyncQueue(task: Omit<PendingSyncTask, 'id' | 'timestamp'>) {
  const queue = getSyncQueue();
  queue.push({
    ...task,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    timestamp: Date.now(),
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  
  // Try to process immediately if online
  if (navigator.onLine) {
    processSyncQueue();
  }
}

function removeFromSyncQueue(id: string) {
  const queue = getSyncQueue();
  const newQueue = queue.filter(t => t.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
}

// Global flag to prevent concurrent processing
let isProcessingQueue = false;

export async function processSyncQueue() {
  if (isProcessingQueue) return;
  if (!navigator.onLine) return;

  const queue = getSyncQueue();
  if (queue.length === 0) return;

  isProcessingQueue = true;
  console.log(`[OfflineSync] Processing ${queue.length} pending tasks...`);

  try {
    for (const task of queue) {
      if (!navigator.onLine) break;

      try {
        if (task.type === 'SHEET_SYNC') {
          const { sheetId, rowData, tabName } = task.payload;
          
          // Ensure we have a valid token
          await googleManager.ensureValidToken();
          
          if (googleManager.accessToken) {
             await syncToGoogleSheets(sheetId, rowData, tabName);
             removeFromSyncQueue(task.id);
          } else {
             console.warn("[OfflineSync] Could not secure valid token for sync task.");
             break;
          }
        }
      } catch (e: any) {
        if (e.message?.includes('Google Sheet not found')) {
           console.warn("[OfflineSync] Task permanently failed due to config issue (Google Sheet not found). Removing from queue.");
           removeFromSyncQueue(task.id);
        } else if (e.message?.includes('AUTH_REQUIRED')) {
           console.warn("[OfflineSync] Task deferred: Google authentication required or expired. Keeping in queue.");
           // Dispatch event so UI can show a notification
           if (typeof window !== 'undefined') {
               window.dispatchEvent(new CustomEvent('auth-required'));
           }
           break;
        } else {
           console.error("[OfflineSync] Task failed due to an unexpected error:", e);
           break; 
        }
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

// Initialize listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log("[OfflineSync] Network back online, starting sync...");
    processSyncQueue();
  });

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      processSyncQueue();
    }
  });
}
