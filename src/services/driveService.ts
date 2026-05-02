import { googleManager } from './GoogleWorkspaceManager';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
}

export async function listDriveFiles(folderId: string = 'root'): Promise<DriveFile[]> {
  const response = await googleManager.callAPI(
    `/api/drive/listFiles`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ folderId })
    }
  );
  
  const data = await response.json();
  return data.files || [];
}

export async function findDriveFolder(name: string, parentId?: string): Promise<string | null> {
    // Safety check to prevent Client ID from being used as Folder ID
    if (parentId && parentId.includes('.apps.googleusercontent.com')) {
        console.warn("Invalid parentId provided for Drive API (looks like a Client ID). Ignoring parentId.");
        parentId = undefined;
    }

    const res = await googleManager.callAPI('/api/drive/findOrCreateFolder', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, parentId })
    });
    const data = await res.json();
    return data.id;
}

export async function deleteDriveFile(fileId: string): Promise<void> {
    await googleManager.callAPI(`/api/drive/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId })
    });
}

export async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
    // Safety check to prevent Client ID from being used as Folder ID
    if (parentId && parentId.includes('.apps.googleusercontent.com')) {
        console.warn("Invalid parentId provided for Drive API (looks like a Client ID). Ignoring parentId.");
        parentId = undefined;
    }

    const res = await googleManager.callAPI('/api/drive/findOrCreateFolder', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, parentId })
    });
    
    const data = await res.json();
    return data.id;
}

export async function moveFile(fileId: string, targetFolderId: string): Promise<void> {
    await googleManager.callAPI('/api/drive/moveAndRename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, targetFolderId, newName: undefined })
    });
}

export async function renameFile(fileId: string, newName: string): Promise<void> {
    await googleManager.callAPI('/api/drive/moveAndRename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, newName, targetFolderId: undefined })
    });
}

export async function uploadFileToDrive(file: File, folderId: string, customName?: string): Promise<string> {
    if (!folderId) throw new Error('Target folder ID is missing');
    if (folderId.includes('.apps.googleusercontent.com')) {
        throw new Error('Target folder ID is invalid (appears to be a Client ID)');
    }
    
    const formData = new FormData();
    formData.append('folderId', folderId);
    if (customName) formData.append('fileName', customName);
    formData.append('file', file);
    
    const res = await googleManager.callAPI('/api/drive/upload', {
        method: 'POST',
        body: formData
    });

    const data = await res.json();
    if (!data.id) throw new Error('Backend did not return a file ID');
    return data.id;
}
