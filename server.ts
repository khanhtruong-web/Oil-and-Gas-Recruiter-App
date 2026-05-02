import express from "express";
import multer from "multer";
import path from "path";

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get(['/auth/callback', '/auth/callback/'], (req, res) => {
    res.send(`
      <html>
        <body>
          <script>
            // Parse token from hash (implicit flow) or query params
            let token = null;
            let expiresIn = null;
            let err = null;
            
            if (window.location.hash) {
                const params = new URLSearchParams(window.location.hash.substring(1));
                token = params.get('access_token');
                expiresIn = params.get('expires_in');
                err = params.get('error');
            } else if (window.location.search) {
                const params = new URLSearchParams(window.location.search);
                err = params.get('error');
            }

            if (window.opener) {
              if (token) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token, expiresIn }, '*');
              } else {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: err || 'No token provided' }, '*');
              }
              window.close();
            } else {
              document.body.innerHTML = 'Authentication completed. You can close this window now.';
            }
          </script>
        </body>
      </html>
    `);
  });

  // ---- API GATEWAY / CORE SERVICES LAYER ----

  // proxy to Google APIs to avoid direct client calls
  async function callGoogleApi(url: string, opts: RequestInit) {
    const res = await fetch(url, opts);
    let data;
    try {
        data = await res.json();
    } catch {
        data = await res.text();
    }
    if (!res.ok) {
        console.error("DEBUG: Google API Error Detail:", JSON.stringify(data, null, 2));
        console.error("Google API Error on URL:", url, "Status:", res.status, "Response:", data);
        const msg = data?.error?.message || (typeof data === 'string' ? data : JSON.stringify(data)) || "Google API Error";
        throw { status: res.status, message: msg };
    }
    return data;
  }
  
  function extractToken(req: express.Request): string | null {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
          return authHeader.substring(7);
      }
      return req.body?.token?.toString() || req.body?.driveToken?.toString() || null;
  }

  function extractId(urlOrId: string | undefined): string | undefined {
      if (!urlOrId) return urlOrId;
      let cleaned = urlOrId.toString().trim();
      try {
          cleaned = decodeURIComponent(cleaned);
      } catch (e) { /* ignore */ }
      
      // Try common URL patterns
      const spreadsheetMatch = cleaned.match(/\/spreadsheets\/(?:d\/)?([a-zA-Z0-9_-]+)/);
      if (spreadsheetMatch && spreadsheetMatch[1]) return spreadsheetMatch[1];
      
      const folderMatch = cleaned.match(/(?:\/|^)folders\/([a-zA-Z0-9_-]+)/);
      if (folderMatch && folderMatch[1]) return folderMatch[1];
      
      const fileMatch = cleaned.match(/(?:\/|^)d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch && fileMatch[1]) return fileMatch[1];
      
      const idMatch = cleaned.match(/id=([a-zA-Z0-9_-]+)/);
      if (idMatch && idMatch[1]) return idMatch[1];
      
      // Generic case: detect ID-like string (25-100 chars) surrounded by slashes or separators
      const genericIdMatch = cleaned.match(/\/([a-zA-Z0-9_-]{25,100})(\/|$|\?|#)/);
      if (genericIdMatch && genericIdMatch[1]) return genericIdMatch[1];

      // If it's not a URL, it might be an ID with suffixes "ID/edit..."
      if (!cleaned.includes('://')) {
          return cleaned.split('/')[0].split('?')[0].split('#')[0];
      }

      return cleaned;
  }

  // File Service (Google Drive Integration) - Server side
  app.post("/api/drive/listFiles", async (req, res) => {
    try {
        const token = extractToken(req);
        const { folderId } = req.body;
        if (!token) return res.status(400).json({ error: "Missing token" });

        const targetFolderId = extractId(folderId) || 'root';
        const encodedQuery = encodeURIComponent(`'${targetFolderId}' in parents and trashed=false`);
        
        const data = await callGoogleApi(
            `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&fields=files(id,name,mimeType,webViewLink)`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        res.json(data);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || error });
    }
  });

  app.post("/api/drive/delete", async (req, res) => {
    try {
        const token = extractToken(req);
        const { fileId } = req.body;
        const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!driveRes.ok) {
            const data = await driveRes.json().catch(() => null);
            throw { status: driveRes.status, message: data?.error?.message || "Failed to delete" };
        }
        res.json({ success: true });
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || error });
    }
  });

  app.post("/api/drive/getFile", async (req, res) => {
    try {
        const token = extractToken(req);
        const { fileId } = req.body;
        
        // First get metadata to check mime type
        const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!metaRes.ok) {
            const data = await metaRes.json().catch(() => null);
            throw { status: metaRes.status, message: data?.error?.message || "Failed to get file metadata" };
        }
        
        const meta = await metaRes.json();
        const isGoogleFormat = meta.mimeType && meta.mimeType.startsWith('application/vnd.google-apps');
        
        let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        if (isGoogleFormat) {
            // Export docs to PDF
            let exportMime = 'application/pdf';
            if (meta.mimeType === 'application/vnd.google-apps.spreadsheet') exportMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            if (meta.mimeType === 'application/vnd.google-apps.presentation') exportMime = 'application/pdf';
            url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${exportMime}`;
        }

        const driveRes = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!driveRes.ok) {
            const data = await driveRes.json().catch(() => null);
            throw { status: driveRes.status, message: data?.error?.message || "Failed to get file" };
        }
        
        let contentType = driveRes.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        
        const buffer = await driveRes.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || error });
    }
  });

  app.post("/api/drive/upload", upload.single("file"), async (req, res) => {
    try {
      const token = extractToken(req) || req.body?.token;
      let { folderId, fileName } = req.body;
      folderId = extractId(folderId);
      const file = req.file;
      
      if (!file) return res.status(400).json({ error: "No file provided" });
      if (!token || !folderId) return res.status(400).json({ error: "Missing token or folderId" });

      const metadata = {
        name: fileName || file.originalname,
        parents: [folderId],
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([file.buffer], { type: file.mimetype }));

      const result = await callGoogleApi(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form as any,
        }
      );
      res.json(result);
    } catch (error: any) {
      console.error("Backend Upload Error", error);
      res.status(error.status || 500).json({ error: error.message || error });
    }
  });

  app.post("/api/drive/findOrCreateFolder", async (req, res) => {
    try {
      const token = extractToken(req);
      let { name, parentId } = req.body;
      parentId = extractId(parentId);
      if (!token || !name) return res.status(400).json({ error: "Missing token or name" });

      const query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false${parentId ? ` and '${parentId}' in parents` : ''}`;
      
      const searchData = await callGoogleApi(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (searchData.files && searchData.files.length > 0) {
        return res.json({ id: searchData.files[0].id });
      }

      // Create new
      const createData = await callGoogleApi(
        'https://www.googleapis.com/drive/v3/files',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentId ? [parentId] : undefined
          })
        }
      );
      res.json({ id: createData.id });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message || error });
    }
  });

  app.post("/api/drive/moveAndRename", async (req, res) => {
    try {
        const token = extractToken(req);
        let { fileId, targetFolderId, newName } = req.body;
        targetFolderId = extractId(targetFolderId);
        
        // 1. Rename
        if (newName) {
            await callGoogleApi(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
        }

        // 2. Move
        if (targetFolderId) {
            const fileRes = await callGoogleApi(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const previousParents = (fileRes.parents || []).join(',');
            await callGoogleApi(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${targetFolderId}&removeParents=${previousParents}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
        }

        res.json({ success: true });
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || error });
    }
  });

  // ---- SHEETS PROXY ENDPOINTS ----

  app.post("/api/sheets/append", async (req, res) => {
    try {
        const token = extractToken(req);
        let { sheetId, range, values } = req.body;
        if (!token || !sheetId || !range || !values) return res.status(400).json({ error: "Missing required parameters" });

        sheetId = extractId(sheetId);
        const encodedSheetId = encodeURIComponent(sheetId as string);
        const encodedRange = encodeURIComponent(range);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodedSheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED`;

        const data = await callGoogleApi(url, {
            method: 'POST',
            headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values })
        });
        res.json(data);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || error });
    }
  });

  app.post("/api/sheets/batchUpdate", async (req, res) => {
    try {
        const token = extractToken(req);
        let { sheetId, requests } = req.body;
        if (!token || !sheetId || !requests) return res.status(400).json({ error: "Missing required parameters" });

        sheetId = extractId(sheetId);
        const encodedSheetId = encodeURIComponent(sheetId as string);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodedSheetId}:batchUpdate`;

        const data = await callGoogleApi(url, {
            method: 'POST',
            headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ requests })
        });
        res.json(data);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || error });
    }
  });

  app.post("/api/sheets/get", async (req, res) => {
    try {
        const token = extractToken(req);
        let { sheetId, range } = req.body;
        if (!token || !sheetId || !range) return res.status(400).json({ error: "Missing required parameters" });

        sheetId = extractId(sheetId);
        const encodedSheetId = encodeURIComponent(sheetId as string);
        const encodedRange = encodeURIComponent(range);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodedSheetId}/values/${encodedRange}`;

        const data = await callGoogleApi(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.json(data);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || error });
    }
  });

  app.post("/api/sheets/metadata", async (req, res) => {
    try {
        const token = extractToken(req);
        let { sheetId } = req.body;
        if (!token || !sheetId) return res.status(400).json({ error: "Missing required parameters" });

        sheetId = extractId(sheetId);
        const encodedSheetId = encodeURIComponent(sheetId as string);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodedSheetId}`;

        const data = await callGoogleApi(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.json(data);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || error });
    }
  });

  // CV Service: APPROVE Action
  app.post("/api/cvs/:id/approve", async (req, res) => {
    try {
        const { id } = req.params;
        const driveToken = extractToken(req);
        let { fileId, discipline, driveRootFolderId, newName, docPath } = req.body;
        
        driveRootFolderId = extractId(driveRootFolderId);
        fileId = extractId(fileId);

        if (fileId && driveRootFolderId) {
            // Find or create discipline folder
            const safeName = (discipline || 'Uncategorized').replace(/'/g, "\\'");
            const query = `'${driveRootFolderId}' in parents and name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            const searchRes = await callGoogleApi(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&spaces=drive`,
                { headers: { Authorization: `Bearer ${driveToken}` } }
            );
            
            let disciplineFolderId;
            if (searchRes.files && searchRes.files.length > 0) {
                disciplineFolderId = searchRes.files[0].id;
            } else {
                const createRes = await callGoogleApi('https://www.googleapis.com/drive/v3/files', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: discipline || 'Uncategorized',
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: [driveRootFolderId]
                    })
                });
                disciplineFolderId = createRes.id;
            }

            // Create Contracts and Projects subfolders
            for (const sub of ['Contracts', 'Projects']) {
                const subQuery = `'${disciplineFolderId}' in parents and name = '${sub}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
                const subSearch = await callGoogleApi(
                    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subQuery)}&fields=files(id)`,
                    { headers: { Authorization: `Bearer ${driveToken}` } }
                );
                if (!subSearch.files || subSearch.files.length === 0) {
                    await callGoogleApi('https://www.googleapis.com/drive/v3/files', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: sub,
                            mimeType: 'application/vnd.google-apps.folder',
                            parents: [disciplineFolderId]
                        })
                    });
                }
            }

            // Patch File
            await callGoogleApi(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });

            // Move
            const fileRes = await callGoogleApi(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`, {
                headers: { Authorization: `Bearer ${driveToken}` }
            });
            const previousParents = (fileRes.parents || []).join(',');
            
            // Try standard move
            try {
                await callGoogleApi(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${disciplineFolderId}&removeParents=${previousParents}`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${driveToken}` }
                });
            } catch (moveError: any) {
                // If insufficient permissions to remove from parents, at least try to add to new parent
                if (moveError.status === 403 || moveError.message?.toLowerCase().includes('permission')) {
                    console.warn("Insufficient permissions to remove parents, attempting add-only move");
                    await callGoogleApi(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${disciplineFolderId}`, {
                        method: 'PATCH',
                        headers: { Authorization: `Bearer ${driveToken}` }
                    });
                } else {
                    throw moveError;
                }
            }
        }
        res.json({ success: true, message: "Drive transaction completed" });
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || error });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - __dirname is not defined in ES module scope if we were running raw
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
