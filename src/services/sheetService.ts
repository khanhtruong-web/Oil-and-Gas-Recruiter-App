import { googleManager } from './GoogleWorkspaceManager';

function extractGoogleObjId(urlOrId: string): string {
  if (!urlOrId) return urlOrId;
  urlOrId = urlOrId.trim();
  
  const dMatch = urlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) return dMatch[1];
  const spreadMatch = urlOrId.match(/\/spreadsheets\/([a-zA-Z0-9_-]+)/);
  if (spreadMatch && spreadMatch[1]) return spreadMatch[1];
  let potentialId = urlOrId;
  if (urlOrId.includes('://')) {
    const genericIdMatch = urlOrId.match(/\/([a-zA-Z0-9_-]{25,100})(\/|$|\?|#)/);
    if (genericIdMatch && genericIdMatch[1]) return genericIdMatch[1];
  } else {
    potentialId = urlOrId.split('/')[0].split('?')[0].split('#')[0];
  }
  return potentialId;
}

async function callGoogleApiDirect(url: string, options: RequestInit = {}) {
  const token = await googleManager.ensureValidToken();
  if (!token) throw new Error("AUTH_REQUIRED: Authentication required for Google services.");
  const res = await fetch(url, {
      ...options,
      headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
      }
  });
  if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error?.message || `HTTP Error ${res.status}`);
  }
  return res.json();
}

export async function syncToGoogleSheets(sheetId?: string, values?: any[], sheetName: string = 'Sheet1') {
  if (!sheetId || !values) return;
  sheetId = extractGoogleObjId(sheetId);
  
  const safeSheetName = sheetName.replace(/[/\\?*[\]]/g, '_');
  const quotedSheetName = `'${safeSheetName.replace(/'/g, "''")}'`;
  const range = `${quotedSheetName}!A:A`;

  try {
    console.log(`[Sheets] Appending to sheet: ${sheetId}, range: ${range}`);
    await callGoogleApiDirect(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [values] }),
    });
  } catch (err: any) {
    const errorMsg = err.message || JSON.stringify(err);
    if (!errorMsg.includes('AUTH_REQUIRED')) {
        console.error(`[Sheets] Append failed for range "${range}":`, errorMsg);
    }
    
    if (errorMsg.includes("Unable to parse range") || errorMsg.includes("400") || errorMsg.toLowerCase().includes("range") || errorMsg.includes("INVALID_ARGUMENT")) {
      try {
        await callGoogleApiDirect(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: { title: safeSheetName }
                }
              }
            ]
          })
        });

        await callGoogleApiDirect(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [values] }),
        });
        return;
      } catch (innerErr: any) {
         console.error("Failed to create sheet or retry append", innerErr);
         throw innerErr;
      }
    }
    
    if (err.message?.includes("Requested entity was not found") || err.message?.includes("404")) {
      throw new Error("Google Sheet not found. Please check if the Google Sheet ID is correct and you have access to it.");
    }
    throw err;
  }
}

export async function logActivity(sheetId?: string, userEmail?: string, action?: string, details?: string) {
  if (!sheetId) return;
  const values = [new Date().toISOString(), userEmail, action, details];
  try {
    const token = await googleManager.ensureValidToken();
    if (!token) return;
    await syncToGoogleSheets(sheetId, values, 'ActivityLog');
  } catch (error: any) {
    if (error.message?.includes('Google Sheet not found')) {
      console.warn('Activity logging skipped: ' + error.message);
      return;
    }
    console.error('Failed to log activity to Google Sheets', error);
    if (error.message.includes('API is disabled')) {
        throw error;
    }
  }
}
