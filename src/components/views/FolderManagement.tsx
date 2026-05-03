import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../AuthProvider';
import { onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserSettings } from '../../types';
import { listDriveFiles } from '../../services/driveService';
import { Loader2, FolderTree, Database, FileText, AlertCircle, Info, CloudUpload, HardDrive, CheckCircle2, Folder, Network, Archive } from 'lucide-react';
import { useDisciplines } from '../../hooks/useDisciplines';
import { toast } from 'sonner';
import { getSafeDisciplineFolderName } from '../../lib/drive-utils';
import { handleFirestoreError, OperationType } from '../../lib/firestore-error';

export const FolderManagement = ({ candidates = [] }: { candidates?: any[] }) => {
    const { user, accessToken: authProviderToken, signIn, refreshTokenSilently, authorizeDrive } = useAuth();
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [files, setFiles] = useState<any[]>([]);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [syncError, setSyncError] = useState<string | null>(null);

    const [syncProgress, setSyncProgress] = useState<{current: number, total: number} | null>(null);
    const { disciplines: DISCIPLINE_NAMES } = useDisciplines();

    const [manualToken, setManualToken] = useState('');
    const [sourceId, setSourceId] = useState('');
    const [rootId, setRootId] = useState('');

    // The active token depends on whether they provided a manual override
    const activeToken = manualToken || settings?.driveToken || authProviderToken;

    useEffect(() => {
        if (!user) return;
        return onSnapshot(doc(db, 'settings', user.uid), (d) => {
            if (d.exists()) {
                const data = d.data() as UserSettings;
                setSettings(data);
                if (data.driveToken) setManualToken(data.driveToken);
                if (data.driveSourceFolderId) setSourceId(data.driveSourceFolderId);
                if (data.driveRootFolderId) setRootId(data.driveRootFolderId);
            }
            setLoading(false);
        }, (error) => {
            handleFirestoreError(error, OperationType.GET, 'settings');
            setLoading(false);
        });
    }, [user]);

    const saveSettings = async () => {
        if (!user || !settings) return;
        try {
            await setDoc(doc(db, 'settings', user.uid), {
                ...settings,
                driveToken: manualToken,
                driveSourceFolderId: sourceId,
                driveRootFolderId: rootId,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            toast.success("Drive configuration saved successfully");
        } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, 'settings');
            toast.error("Failed to save settings");
        }
    }

    const fetchFiles = async (forceAuth: boolean = false) => {
        if (!rootId) return;
        
        let token = activeToken;

        if (!token && forceAuth && authorizeDrive) {
           try {
               token = await authorizeDrive();
           } catch(e) {
               console.warn("Drive auth failed", e);
           }
        }
        
        if (!token) {
           setSyncStatus('idle');
           return;
        }
        
        setSyncStatus('syncing');
        setSyncError(null);
        
        try {
            const data = await listDriveFiles(rootId);
            setFiles(data);
            setSyncStatus('success');
        } catch (e: any) {
            if (!e.message?.includes('AUTH_REQUIRED')) {
                 console.error(e);
            }
            setSyncStatus('error');
            if (e.message?.includes('AUTH_REQUIRED')) {
                setSyncError('Authentication Required. Please connect your Google account in Settings.');
            } else {
                setSyncError(e.message || 'Failed to connect to Google Drive API');
            }
        }
    };

    const syncDisciplinesToDrive = async () => {
        let token = activeToken;
        if (!token && authorizeDrive) {
           try {
               token = await authorizeDrive();
           } catch(e: any) {
               return toast.error('Drive access failed: ' + e.message);
           }
        }
        if (!token) {
            return toast.error('Drive access token not available. Please authenticate or provide an OAuth2 token.');
        }
        let currentRootId = rootId;
        try {
            const { findOrCreateFolder } = await import('../../services/driveService');

            if (!currentRootId) {
                toast.info("Auto-creating root folder 'OilGas_CV_Management_2026'...");
                currentRootId = await findOrCreateFolder('OilGas_CV_Management_2026', undefined);
                setRootId(currentRootId);
                if (user) {
                    await setDoc(doc(db, 'settings', user.uid), {
                       ...settings,
                       driveRootFolderId: currentRootId
                    }, { merge: true });
                }
            }

            setSyncStatus('syncing');
            setSyncProgress({ current: 0, total: DISCIPLINE_NAMES.length });
            
            for (let i = 0; i < DISCIPLINE_NAMES.length; i++) {
                const name = getSafeDisciplineFolderName(DISCIPLINE_NAMES[i]);
                setSyncProgress({ current: i + 1, total: DISCIPLINE_NAMES.length });
                await findOrCreateFolder(name, currentRootId);
            }
            
            toast.success('All disciplines synchronized with Google Drive');
            await fetchFiles(true);
        } catch (e: any) {
            if (!e.message?.includes('AUTH_REQUIRED')) {
                 console.error(e);
            }
            if (e.message?.includes('AUTH_REQUIRED')) {
                toast.error('Authentication Required', {
                    description: 'Please go to Settings and click "Connect Google Account".'
                });
            } else {
                toast.error('Sync failed: ' + e.message);
            }
            setSyncStatus('error');
            setSyncError(e.message);
        } finally {
            setSyncProgress(null);
        }
    };

    const syncDataToSheets = async () => {
        if (!settings?.googleSheetId) {
            return toast.error('Please configure your Google Sheet ID in Settings first.');
        }

        let token = activeToken;
        if (!token && authorizeDrive) {
            try {
                toast.info("Authentication required. Requesting access...");
                token = await authorizeDrive() || undefined;
            } catch (e) {
                return toast.error("Google authentication failed. Cannot sync.");
            }
        }
        
        if (!token) {
            return toast.error("Authentication required to sync data.");
        }

        setSyncStatus('syncing');
        setSyncError(null);
        try {
            const { syncToGoogleSheets } = await import('../../services/sheetService');
            
            toast.loading('Syncing discipline sheets...', { id: 'sheet-sync' });
            
            for (let i = 0; i < DISCIPLINE_NAMES.length; i++) {
                const disc = DISCIPLINE_NAMES[i];
                const safeDiscipline = disc.replace(/[^a-zA-Z0-9_ -]/g, '_');
                const tabName = `CVs_${safeDiscipline}`;
                
                const candidatesForDisc = candidates.filter(c => c.discipline === disc && c.currentStatus?.toLowerCase() !== 'deleted');
                
                // Keep it fast, we can just send everything
                for (const c of candidatesForDisc) {
                    await syncToGoogleSheets(settings.googleSheetId, [
                        c.candidateName || 'N/A',
                        c.discipline || 'N/A',
                        c.yearsExp || '0',
                        c.workFields || 'N/A',
                        c.currentStatus || 'New',
                        '' // Actions
                    ], tabName);
                }
            }
            
            toast.success('Successfully synced all candidates to Google Sheets', { id: 'sheet-sync' });
            setSyncStatus('success');
        } catch (e: any) {
             if (!e.message?.includes('AUTH_REQUIRED')) {
                 console.error('Sheet sync failed', e);
             }
             if (e.message?.includes('AUTH_REQUIRED')) {
                 toast.error('Sync failed: Authentication required. Please reconnect your Google account.', { id: 'sheet-sync' });
             } else {
                 toast.error('Sheet sync failed: ' + e.message, { id: 'sheet-sync' });
             }
             setSyncStatus('error');
        }
    };

    useEffect(() => {
        if (rootId) {
            fetchFiles();
        }
    }, [rootId, activeToken]);

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

    return (
        <div className="space-y-4 max-w-full overflow-hidden animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-black flex items-center gap-2 text-slate-800">
                        <FolderTree className="w-7 h-7 text-amber-500" />
                        Folder Management
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Google Drive folder structure for CV organization</p>
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="outline"
                        className="rounded-xl px-5 border-slate-200"
                        onClick={syncDataToSheets}
                        disabled={syncStatus === 'syncing' || !settings?.googleSheetId}
                    >
                        <Database className="w-4 h-4 mr-2 text-emerald-500" />
                        Sync to Sheets
                    </Button>
                    <Button 
                        className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl px-5"
                        onClick={syncDisciplinesToDrive}
                        disabled={syncStatus === 'syncing' || !activeToken || !rootId}
                    >
                        <CloudUpload className="w-4 h-4 mr-2" />
                        Create on Drive
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* LEFT: FOLDER STRUCTURE PREVIEW */}
                <Card className="lg:col-span-2 border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="bg-white pb-3">
                        <CardTitle className="text-[0.95rem] font-bold flex items-center justify-between text-slate-800">
                            <div className="flex items-center gap-2">
                                <Network className="w-5 h-5 text-amber-600" />
                                Folder Structure Preview
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-xs px-2 flex items-center gap-1 border-slate-200" 
                                onClick={() => fetchFiles(true)}
                                disabled={syncStatus === 'syncing' || !activeToken || !rootId}
                            >
                                <CloudUpload className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-pulse text-amber-500' : 'text-slate-400'}`} />
                                {syncStatus === 'syncing' ? 'Refreshing...' : 'Refresh'}
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="p-4 bg-white min-h-[400px]">
                            {rootId ? (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 font-bold text-[0.95rem] text-slate-800 py-1">
                                        <Archive className="w-5 h-5 text-amber-600 fill-current" />
                                        OilGas_CV_Management_2026/
                                    </div>
                                    <div className="pl-6 pt-1 space-y-1 border-l-2 border-slate-100 ml-2">
                                        {DISCIPLINE_NAMES.map((disc, idx) => {
                                            const fName = getSafeDisciplineFolderName(disc);
                                            const isFound = files.some(f => f.name === fName);
                                            const folderCandidates = candidates.filter(c => c.discipline === disc && c.driveFileId && c.currentStatus?.toLowerCase() !== 'deleted');
                                            return (
                                                <div key={idx} className="space-y-1">
                                                    <div className="flex items-center gap-2 text-[0.85rem] text-slate-600 py-1">
                                                        <Folder className="w-4 h-4 text-[#f59e0b] fill-current" />
                                                        <span className={isFound ? "font-semibold text-slate-700" : "font-medium"}>{fName}/</span>
                                                        <span className="text-slate-400 text-xs">({folderCandidates.length} CVs)</span>
                                                    </div>
                                                    {folderCandidates.length > 0 && (
                                                        <div className="pl-6 space-y-1 border-l border-slate-100 ml-2 py-1">
                                                            {folderCandidates.map((cand, cIdx) => (
                                                                <div key={cIdx} className="flex items-center gap-2 text-[0.8rem] text-slate-500 py-0.5">
                                                                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                                                                    <span className="truncate max-w-[200px]" title={cand.candidateName}>{cand.candidateName}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20 text-center">
                                    <FolderTree className="w-12 h-12 mb-3 text-slate-200" />
                                    <p className="text-sm">Configure Root Folder ID to see preview</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* RIGHT: DRIVE CONFIG */}
                <Card className="lg:col-span-3 border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="bg-white pb-3">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700">
                            <CloudUpload className="w-4 h-4 text-emerald-500" />
                            Google Drive Config
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 bg-white space-y-6">
                        
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-600">
                            <p className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                                <Info className="w-4 h-4 text-slate-500" />
                                Important Setup Steps:
                            </p>
                            <ol className="list-decimal pl-5 space-y-1.5 marker:text-slate-400">
                                <li><strong>Global Configuration:</strong> The <strong>Root Destination Folder ID</strong> is managed globally by the Admin in the Settings tab. You do not need to configure it manually.</li>
                                <li><strong>Connect Google Account:</strong> Click <strong>"Connect Google Account"</strong> in the Settings tab so this app can access Google Drive using your credentials.</li>
                                <li><strong>Folder Permissions:</strong> The company admin MUST share the destination Google Drive folder with your email.</li>
                                <li><strong>Data Entry Guidelines:</strong> Because the API keys and IDs are synchronized globally from the admin's configuration (`system_config`), you do not need any API Keys, manual tokens, or Folder IDs. Simply log in and click the "Sync" buttons!</li>
                            </ol>

                            <div className="mt-4 pt-4 border-t border-slate-200">
                                <p className="font-bold text-rose-600 flex items-center gap-1.5 mb-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Troubleshooting Errors:
                                </p>
                                <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs">
                                   <li><strong>"Authentication Required":</strong> Ensure you clicked "Connect Google Account" in the Settings tab.</li>
                                   <li><strong>"File not found: .":</strong> The admin has not set up the Root Destination Folder ID in Settings, or you don't have access to that folder.</li>
                                </ul>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-1">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Root Destination Folder ID</Label>
                                <div className="font-mono text-sm bg-slate-100 p-2 rounded-md truncate" title={rootId || 'Not Configured'}>
                                    {rootId || <span className="text-slate-400 italic">Not Configured globally</span>}
                                </div>
                            </div>
                            <div className="md:col-span-1">
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Source Folder ID (Auto-Scan)</Label>
                                <div className="font-mono text-sm bg-slate-100 p-2 rounded-md truncate" title={sourceId || 'Not Configured'}>
                                    {sourceId || <span className="text-slate-400 italic">Not Configured globally</span>}
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-bold text-slate-800">Drive Activity Log</h4>
                                {syncStatus === 'syncing' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                            </div>
                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 h-[140px] overflow-y-auto font-mono text-xs text-slate-600 shadow-inner">
                                {syncStatus === 'idle' && !syncError && <span className="opacity-50">No activity yet.</span>}
                                {syncStatus === 'syncing' && (
                                    <div className="text-blue-600 mb-1">
                                        <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
                                        Synchronizing folders... {syncProgress && `(${syncProgress.current}/${syncProgress.total})`}
                                    </div>
                                )}
                                {syncError && (
                                    <div className="text-red-500 mb-1">
                                        <span className="opacity-50 mr-2 text-slate-500">[{new Date().toLocaleTimeString()}]</span>
                                        Error: {syncError}
                                        {syncError.includes('authentication') || syncError.includes('Token') || syncError.includes('401') ? (
                                            <div className="mt-2 text-slate-800">
                                                <p className="mb-2">Your Google Drive session has expired. Please Re-Authenticate to continue.</p>
                                                <Button size="sm" variant="outline" onClick={() => signIn()}>
                                                    Reconnect Google Drive
                                                </Button>
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                                {syncStatus === 'success' && files.length > 0 && (
                                    <div className="text-emerald-600 mb-1">
                                        <span className="opacity-50 mr-2 text-slate-500">[{new Date().toLocaleTimeString()}]</span>
                                        Found {files.length} existing folders/files in Root ID.
                                    </div>
                                )}
                                {files.map(f => (
                                    <div key={f.id} className="text-slate-500 mb-1 truncate">
                                        <span className="opacity-30 mr-2">↳</span>
                                        {f.name} <span className="opacity-50 text-[10px]">({f.id})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
