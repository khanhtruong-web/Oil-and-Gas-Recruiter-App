import { googleManager } from './GoogleWorkspaceManager';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
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
      if (res.status === 401 && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth-required'));
      }
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error?.message || `HTTP Error ${res.status}`);
  }
  return res.json();
}

export async function listDriveFiles(folderId: string = 'root'): Promise<DriveFile[]> {
  const targetFolderId = folderId || 'root';
  const encodedQuery = encodeURIComponent(`'${targetFolderId}' in parents and trashed=false`);
  const data = await callGoogleApiDirect(
      `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&fields=files(id,name,mimeType,webViewLink)`
  );
  return data.files || [];
}

export async function findDriveFolder(name: string, parentId?: string): Promise<string | null> {
    if (parentId && parentId.includes('.apps.googleusercontent.com')) {
        console.warn("Invalid parentId. Ignoring.");
        parentId = undefined;
    }

    const queryInfo = parentId 
        ? `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
        : `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    
    const data = await callGoogleApiDirect(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(queryInfo)}&fields=files(id,name)`
    );
    
    return data.files && data.files.length > 0 ? data.files[0].id : null;
}

export async function deleteDriveFile(fileId: string): Promise<void> {
    const token = await googleManager.ensureValidToken();
    if (!token) throw new Error("AUTH_REQUIRED");
    
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error?.message || `Failed to delete file`);
    }
}

export async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
    if (parentId && parentId.includes('.apps.googleusercontent.com')) {
        parentId = undefined;
    }
    
    const existingId = await findDriveFolder(name, parentId);
    if (existingId) return existingId;

    const metadata: any = {
        name,
        mimeType: 'application/vnd.google-apps.folder'
    };
    if (parentId) metadata.parents = [parentId];

    const data = await callGoogleApiDirect('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
    });
    
    return data.id;
}

export async function moveFile(fileId: string, targetFolderId: string): Promise<void> {
    // Need to get previous parents to remove them
    const file = await callGoogleApiDirect(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`);
    const previousParents = file.parents ? file.parents.join(',') : '';
    
    await callGoogleApiDirect(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${targetFolderId}&removeParents=${previousParents}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
}

export async function renameFile(fileId: string, newName: string): Promise<void> {
    await callGoogleApiDirect(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
    });
}

export async function uploadFileToDrive(file: File, folderId: string, customName?: string): Promise<string> {
    if (!folderId) throw new Error('Target folder ID is missing');
    if (folderId.includes('.apps.googleusercontent.com')) throw new Error('Target folder ID is invalid');
    
    const metadata = {
        name: customName || file.name,
        parents: [folderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);
    
    const data = await callGoogleApiDirect('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        body: form
    });

    if (!data.id) throw new Error('Backend did not return a file ID');
    return data.id;
}
