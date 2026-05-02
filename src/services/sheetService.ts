import { googleManager } from './GoogleWorkspaceManager';

function extractGoogleObjId(urlOrId: string): string {
  if (!urlOrId) return urlOrId;
  urlOrId = urlOrId.trim();
  
  // Try to find the common /d/ID pattern
  const dMatch = urlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) return dMatch[1];

  // Try to find /spreadsheets/ID pattern (sometimes /d/ is omitted in some links)
  const spreadMatch = urlOrId.match(/\/spreadsheets\/([a-zA-Z0-9_-]+)/);
  if (spreadMatch && spreadMatch[1]) return spreadMatch[1];

  // If it's a full URL but didn't match the above, it might be something like docs.google.com/spreadsheets/u/0/d/ID/edit
  // Or if they just pasted the ID but it includes /edit or other stuff
  
  // Strip everything after the first slash if it looks like an ID
  let potentialId = urlOrId;
  if (urlOrId.includes('://')) {
    // It's a full URL, we should have caught it with /d/ or /spreadsheets/ above
    // If not, let's try one more broad regex for ID-like strings in path
    const genericIdMatch = urlOrId.match(/\/([a-zA-Z0-9_-]{25,100})(\/|$|\?|#)/);
    if (genericIdMatch && genericIdMatch[1]) return genericIdMatch[1];
  } else {
    // If it's not a URL, it might be "ID/edit..."
    potentialId = urlOrId.split('/')[0].split('?')[0].split('#')[0];
  }
  
  return potentialId;
}

export async function syncToGoogleSheets(sheetId?: string, values?: any[], sheetName: string = 'Sheet1') {
  if (!sheetId || !values) return;
  sheetId = extractGoogleObjId(sheetId);
  
  // Replace slashes or special characters in sheet name
  const safeSheetName = sheetName.replace(/[/\\?*[\]]/g, '_');
  const range = `${safeSheetName}!A:A`;

  try {
    await googleManager.callAPI('/api/sheets/append', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sheetId,
        range,
        values: [values],
      }),
    });
  } catch (err: any) {
    const errorMsg = err.message || JSON.stringify(err);
    // If range not found, try creating the sheet. Google API returns 400 with "Unable to parse range" or generic 400 for INVALID_ARGUMENT if tab missing
    if (errorMsg.includes("Unable to parse range") || errorMsg.includes("400") || errorMsg.toLowerCase().includes("range") || errorMsg.includes("INVALID_ARGUMENT")) {
      try {
        // Create the sheet via proxy
        await googleManager.callAPI('/api/sheets/batchUpdate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sheetId,
            requests: [
              {
                addSheet: {
                  properties: {
                    title: safeSheetName
                  }
                }
              }
            ]
          })
        });

        // Retry appending via proxy
        await googleManager.callAPI('/api/sheets/append', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sheetId,
            range,
            values: [values],
          }),
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
    // Background logging should not throw authentication errors to the user
    const token = await googleManager.ensureValidToken();
    if (!token) return;

    await syncToGoogleSheets(sheetId, values, 'ActivityLog');
  } catch (error: any) {
    if (error.message?.includes('Google Sheet not found')) {
      console.warn('Activity logging skipped: ' + error.message);
      return;
    }
    console.error('Failed to log activity to Google Sheets', error);
    // Only rethrow critical configuration errors
    if (error.message.includes('API is disabled')) {
        throw error;
    }
  }
}
