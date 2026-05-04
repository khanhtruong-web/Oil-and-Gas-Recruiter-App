import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Settings as SettingsIcon, 
    Database, 
    CheckCircle2, 
    Users,
    Tags,
    Plus,
    X,
    Trash2,
    ShieldAlert,
    UserCircle,
    Cloud,
    FileText,
    BookOpen,
    Key,
    Layers,
    Bot,
    Zap,
    FolderOpen
} from 'lucide-react';
import { useAuth } from '../AuthProvider';
import { UserSettings } from '../../types';
import { onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'sonner';
import { OperationType, handleFirestoreError } from '../../lib/firestore-error';
import { useDisciplines } from '../../hooks/useDisciplines';
import { findOrCreateFolder, findDriveFolder, deleteDriveFile } from '../../services/driveService';

const DisciplineRow = ({ disc, onUpdate, onRemove, readOnly }: any) => {
    const [name, setName] = useState(disc.name);
    const [keywords, setKeywords] = useState(disc.keywords?.join(', ') || '');

    useEffect(() => {
        setName(disc.name);
        setKeywords(disc.keywords?.join(', ') || '');
    }, [disc.name, disc.keywords]);

    const handleBlur = (field: 'name' | 'keywords') => {
        const val = field === 'name' ? name : keywords;
        const currentVal = field === 'name' ? disc.name : (disc.keywords?.join(', ') || '');
        if (val !== currentVal) {
            onUpdate(disc.id, field, val);
        }
    };

    return (
        <div className="flex items-center gap-3 py-1 pb-2">
            <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => handleBlur('name')}
                className="bg-white border-slate-200 h-10 text-[0.85rem] font-medium rounded-xl"
                readOnly={readOnly}
                style={{ flex: '0 0 35%' }}
            />
            <Input 
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                onBlur={() => handleBlur('keywords')}
                className="bg-white border-slate-200 h-10 text-[0.85rem] rounded-xl flex-1 focus-visible:ring-1 focus-visible:ring-slate-300"
                placeholder="Keywords (comma-sep)"
                readOnly={readOnly}
            />
            {(!readOnly) && (
                <Button 
                    variant="outline" 
                    size="icon" 
                    className="w-10 h-10 shrink-0 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-xl transition-colors ml-1"
                    onClick={() => onRemove(disc.id)}
                    title="Remove Discipline"
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            )}
        </div>
    );
};

export const Settings = () => {
    const { user, profile, accessToken, refreshTokenSilently, authorizeDrive } = useAuth();
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);
    
    const { disciplineDetails, loading: disciplinesLoading, updateDisciplines } = useDisciplines();
    const [newDiscipline, setNewDiscipline] = useState('');

    useEffect(() => {
        if (!user) return;
        
        let currentUserSettings: any = null;
        let currentSystemConfig: any = null;

        const updateSettingsData = () => {
            if (!currentUserSettings) return;
            setSettings({ ...currentUserSettings, ...currentSystemConfig } as UserSettings);
        };

        const unsubUser = onSnapshot(doc(db, 'settings', user.uid), (d) => {
            if (d.exists()) {
                currentUserSettings = d.data();
                updateSettingsData();
            }
            setLoading(false);
        }, (error) => {
            handleFirestoreError(error, OperationType.GET, 'settings');
            setLoading(false);
        });

        const unsubSystem = onSnapshot(doc(db, 'settings', 'system_config'), (d) => {
            if (d.exists()) {
                currentSystemConfig = d.data();
                updateSettingsData();
            }
        }, (error) => {});

        return () => {
            unsubUser();
            unsubSystem();
        };
    }, [user]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const extractId = (urlOrId: string) => {
            if (!urlOrId) return urlOrId;
            try {
                urlOrId = decodeURIComponent(urlOrId).trim();
            } catch (e) {
                urlOrId = urlOrId.trim();
            }
            const folderMatch = urlOrId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
            if (folderMatch && folderMatch[1]) return folderMatch[1];
            const fileMatch = urlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (fileMatch && fileMatch[1]) return fileMatch[1];
            return urlOrId;
        };

        const driveId = extractId((e.currentTarget as any).driveId?.value || '');
        const driveSourceId = extractId((e.currentTarget as any).driveSourceId?.value || '');
        const sheetId = extractId((e.currentTarget as any).sheetId?.value || '');
        const googleClientId = (e.currentTarget as any).googleClientId?.value?.trim() || '';
        try {
            await setDoc(doc(db, 'settings', 'system_config'), {
                driveSourceFolderId: driveSourceId || settings?.driveSourceFolderId || '',
                driveRootFolderId: driveId,
                googleSheetId: sheetId,
                googleClientId: googleClientId,
                autoBackupEnabled: settings?.autoBackupEnabled || false,
                updatedAt: serverTimestamp()
            }, { merge: true });
            toast.success('Workspace configurations updated globally');
        } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, 'settings/system_config');
        }
    };

    const handleAddDiscipline = async () => {
        let name = "New Discipline";
        let counter = 1;
        while (disciplineDetails.some(d => d.name.toLowerCase() === name.toLowerCase())) {
            name = `New Discipline ${counter}`;
            counter++;
        }
        
        try {
            const newDiscObj = {
                id: name.toLowerCase().replace(/[^a-z0-9]/g, '_') + Date.now(),
                name: name,
                keywords: [name.toLowerCase()],
                description: ''
            };
            await updateDisciplines([newDiscObj, ...disciplineDetails]);
            toast.success('Added new discipline');
        } catch (e) {
            toast.error('Failed to add discipline');
        }
    };

    const handleRemoveDiscipline = async (discId: string) => {
        const discToRemove = disciplineDetails.find(d => d.id === discId);
        
        try {
            await updateDisciplines(disciplineDetails.filter(d => d.id !== discId));
            
            // Sync with Folder Management (Drive)
            if (discToRemove && settings?.driveRootFolderId) {
                try {
                    const folderId = await findDriveFolder(discToRemove.name, settings.driveRootFolderId);
                    if (folderId) {
                        await deleteDriveFile(folderId);
                        toast.success('Discipline folder removed from Drive');
                    }
                } catch (driveErr) {
                    console.error("Drive error", driveErr);
                }
            }
            
            toast.success('Discipline removed');
        } catch (e) {
            toast.error('Failed to remove discipline');
        }
    };

    const handleUpdateDiscipline = async (discId: string, field: 'name' | 'keywords' | 'description', value: string) => {
        if (field === 'name') {
            const isDuplicate = disciplineDetails.some(d => d.id !== discId && d.name.toLowerCase() === value.trim().toLowerCase());
            if (isDuplicate) {
                toast.error('Discipline name already exists');
                return;
            }
        }
        
        const updatedList = disciplineDetails.map(d => {
            if (d.id === discId) {
                if (field === 'keywords') {
                    return { ...d, keywords: value.split(',').map(k => k.trim()).filter(k => k) };
                }
                return { ...d, [field]: value.trim() };
            }
            return d;
        });
        
        try {
            await updateDisciplines(updatedList);
        } catch (e) {
            toast.error('Failed to update discipline');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2 mb-4">
                <h2 className="text-[1.45rem] font-bold flex items-center gap-2 text-slate-800">
                    <SettingsIcon className="w-6 h-6 text-slate-600" />
                    Settings & User Guide
                </h2>
                <div className="text-slate-500 text-[0.82rem]">Manage disciplines, integrations, and preferences</div>
            </div>

            <Card className="border-[#1e293b] shadow-xl bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl overflow-hidden mb-6">
                <CardContent className="p-6">
                    <div className="space-y-3 text-white">
                        <h3 className="text-lg font-black flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-blue-400" />
                            Getting Started & Synchronization Guide
                        </h3>
                        <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
                            Whether you are an <strong>Admin</strong> or a <strong>Recruiter</strong>, setting up your environment ensures seamless CV synchronization across Google Drive & Sheets.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                <h4 className="text-[0.8rem] font-bold text-blue-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <UserCircle className="w-4 h-4" /> Non-Admin / Recruiter Access
                                </h4>
                                <ul className="space-y-2 text-xs text-slate-300">
                                    <li className="flex items-start gap-2">
                                        <div className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">1</div>
                                        <span>Use the application URL to log in with <strong>Google Authentication</strong>.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <div className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">2</div>
                                        <span>Click <strong>"Connect Google Account"</strong> in the settings below to authorize Drive & Sheets. Admin must grant your email access to the main Drive folder.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <div className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">3</div>
                                        <span>Paste the <strong>Drive Root Folder ID</strong> and <strong>Google Sheet Target ID</strong> provided by the Admin into the fields below.</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                <h4 className="text-[0.8rem] font-bold text-emerald-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Cloud className="w-4 h-4" /> Synchronization Mechanism
                                </h4>
                                <ul className="space-y-2 text-xs text-slate-300">
                                    <li className="flex items-start gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0 px-0" />
                                        <span>CVs can be imported directly from the <strong>Drive Source Folder (Inbox)</strong> in the CV Extraction tab.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0 px-0" />
                                        <span>If AI Extraction fails (e.g. server busy), hover over the failed file in the queue and click the red <strong>Trash icon</strong> to remove it.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0 px-0" />
                                        <span>When a candidate's status is changed to <strong>"Shortlisted"</strong> or <strong>"Hired"</strong>, their CV is automatically moved to the Discipline folder in the Drive Destination.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0 px-0" />
                                        <span>Data is also automatically synced to the <strong>Google Sheet</strong> target as a backup.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* LEFT COLUMN: DISCIPLINES */}
                <div className="md:col-span-7">
                    <Card className="border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] bg-white rounded-2xl overflow-hidden">
                        <CardHeader className="border-b border-slate-100/50 py-4 px-6 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-[1.05rem] font-bold flex items-center gap-2 text-slate-800">
                                <Layers className="w-5 h-5 text-slate-800" />
                                Disciplines
                            </CardTitle>
                            <div className="flex gap-2">
                                {(profile?.role === 'Admin' || profile?.role === 'Recruiter' || !profile) && (
                                    <Button variant="outline" size="sm" onClick={handleAddDiscipline} className="h-8 shadow-sm rounded-lg border-slate-200">
                                        <Plus className="w-4 h-4 mr-1" /> Add
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 bg-slate-50/50">
                            {disciplinesLoading ? (
                                <div className="text-sm text-slate-400 italic py-4 text-center">Loading...</div>
                            ) : (
                                <div className="flex flex-col gap-1">
                                    {disciplineDetails.map((disc, idx) => (
                                        <DisciplineRow 
                                            key={disc.id || idx}
                                            disc={disc}
                                            readOnly={profile?.role === 'Viewer'}
                                            onUpdate={handleUpdateDiscipline}
                                            onRemove={handleRemoveDiscipline}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT COLUMN: INFRASTRUCTURE & SETTINGS */}
                <div className="md:col-span-5 space-y-6">
                    <Card className="border-[#1e293b] shadow-2xl bg-[#0f172a] rounded-2xl overflow-hidden mb-6">
                        <CardContent className="p-6 space-y-5">
                            <div className="space-y-1">
                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                    Gemini AI Engine
                                </h3>
                                <p className="text-slate-400 text-sm">Paste your API key once. The system auto-detects the best available model.</p>
                            </div>
                            
                            <Input 
                                key={`gemini_${settings?.geminiApiKey || 'empty'}`}
                                type="password"
                                placeholder="..." 
                                defaultValue={settings?.geminiApiKey || ''}
                                id="custom_gemini_key_input"
                                className="h-12 text-[1rem] border-[#1e293b] bg-[#1e293b] focus-visible:ring-blue-500 text-white w-full"
                            />
                            
                            <div className="flex flex-wrap gap-3 mt-4">
                                <Button 
                                    size="sm" 
                                    className="h-11 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl flex items-center gap-2"
                                    onClick={async () => {
                                        const val = (document.getElementById('custom_gemini_key_input') as HTMLInputElement).value;
                                        try {
                                            await setDoc(doc(db, 'settings', 'system_config'), { geminiApiKey: val }, { merge: true });
                                            toast.success('AI Configuration updated globally');
                                            setTimeout(() => window.location.reload(), 500);
                                        } catch (err) {
                                            handleFirestoreError(err, OperationType.WRITE, 'settings/system_config');
                                        }
                                    }}
                                >
                                    <Key className="w-4 h-4" /> Save Key Globally
                                </Button>
                                <Button 
                                    type="button"
                                    variant="outline" 
                                    size="sm" 
                                    className="h-11 px-5 border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white rounded-xl flex items-center gap-2"
                                    onClick={async () => {
                                        const val = (document.getElementById('custom_gemini_key_input') as HTMLInputElement).value || settings?.geminiApiKey;
                                        if (!val) return toast.error('Please enter an API key first');
                                        toast.loading('Testing AI Connection...', { id: 'ai-tester' });
                                        try {
                                            const { GoogleGenAI } = await import('@google/genai');
                                            const ai = new GoogleGenAI({ apiKey: val });
                                            await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: 'Hello' });
                                            toast.success('AI Connection Successful: Gemini 2.0 Flash is ready!', { id: 'ai-tester' });
                                        } catch(e: any) {
                                            toast.error('AI Connection Failed: ' + e.message, { id: 'ai-tester' });
                                        }
                                    }}
                                >
                                    <Zap className="w-4 h-4" /> Test Connection
                                </Button>
                            </div>
                            
                            <div className="bg-[#1e293b]/50 border border-[#334155]/50 rounded-xl p-3 flex items-center justify-between mt-4">
                                <div className="flex items-center gap-2">
                                    <Bot className="w-4 h-4 text-slate-400" />
                                    <Zap className="w-4 h-4 text-orange-400" />
                                    <span className="text-purple-400 font-semibold text-sm">Gemini 2.5 Flash</span>
                                    <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-0.5 rounded-full font-medium ml-2">Tier S</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] bg-white rounded-2xl overflow-hidden">
                        <CardHeader className="border-b border-slate-100/50 py-4 px-6">
                            <CardTitle className="text-[0.9rem] font-bold flex items-center gap-2 text-slate-800">
                                <Key className="w-4 h-4 text-amber-500" />
                                Integrations Setup
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <form onSubmit={handleSave} className="space-y-4">
                                <div className="space-y-3">
                                    <div className="bg-slate-50 p-3 rounded-xl border-l-4 border-primary text-[0.78rem] text-slate-600 mb-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <strong className="text-slate-800 block mb-1 text-[0.82rem]">Google Drive / Google Sheets Target</strong>
                                                <p className="mb-2">Enter the IDs where automated extracted CV data and records will be synchronized safely.</p>
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                type="button"
                                                size="sm" 
                                                className="bg-white border-primary text-primary hover:bg-primary/5 h-8 whitespace-nowrap ml-4"
                                                onClick={async () => {
                                                    try {
                                                        const token = await authorizeDrive();
                                                        if (token) toast.success('Google Account Connected Successfully!');
                                                    } catch(e: any) {
                                                        toast.error('Connection failed: ' + (e.message || 'Check your Client ID and origins'));
                                                    }
                                                }}
                                            >
                                                <Cloud className="w-4 h-4 mr-2" />
                                                Connect Google Account
                                            </Button>
                                        </div>
                                        
                                         {profile?.role === 'Admin' ? (
                                        <>
                                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-[0.75rem]">
                                                <strong className="block mb-2 text-emerald-900 border-b border-emerald-200 pb-1">✓ Google Workspace Authentication setup complete</strong>
                                                <div className="space-y-1 mt-2">
                                                    <p>Drive and Sheets integration is now fully managed by your core login identity system.</p>
                                                    <p>If an employee encounters "Authentication required", they only need to click "Connect Google Account" above to refresh their tokens!</p>
                                                </div>
                                            </div>
                                        </>
                                        ) : (
                                            <div className="text-[0.8rem] text-slate-500 mt-2 bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                                                Administrator has configured Google Workspace integration.<br />
                                                If you encounter Drive errors, please click the <strong>Connect Google Account</strong> button above to grant necessary access for your session.
                                            </div>
                                        )}
                                    </div>
                                    
                                    {profile?.role === 'Admin' && (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider block">Drive Source Folder ID</label>
                                            <div className="flex gap-2">
                                            <Input 
                                                name="driveSourceId" 
                                                placeholder="Folder ID for incoming unsorted CVs" 
                                                value={settings?.driveSourceFolderId || ''}
                                                onChange={(e) => setSettings({...settings, driveSourceFolderId: e.target.value})}
                                                className="h-9 text-[0.85rem] border-slate-200 bg-slate-50 flex-1"
                                            />
                                            <Button type="button" variant="outline" size="sm" className="h-9 px-3 shrink-0 text-slate-600" onClick={() => window.open(`https://drive.google.com/drive/folders/${settings?.driveSourceFolderId}`, '_blank')}>
                                                <FolderOpen className="w-4 h-4" />
                                            </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider block">Drive Root Folder ID (Destination)</label>
                                            <div className="flex gap-2">
                                            <Input 
                                                name="driveId" 
                                                placeholder="Paste Folder ID here (e.g. 1A2b3C4d...)" 
                                                value={settings?.driveRootFolderId || ''}
                                                onChange={(e) => setSettings({...settings, driveRootFolderId: e.target.value})}
                                                className="h-9 text-[0.85rem] border-slate-200 bg-slate-50 flex-1"
                                            />
                                            <Button type="button" variant="outline" size="sm" className="h-9 px-3 shrink-0 text-slate-600" onClick={() => window.open(`https://drive.google.com/drive/folders/${settings?.driveRootFolderId}`, '_blank')}>
                                                <FolderOpen className="w-4 h-4" />
                                            </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider block">Google Sheets Target ID</label>
                                                <div className="flex gap-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        type="button"
                                                        size="sm" 
                                                        className="h-6 text-[0.65rem] px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                        onClick={async () => {
                                                            if (!settings?.googleSheetId) return toast.error('Please enter a Google Sheet ID first');
                                                            
                                                            let token = accessToken;
                                                            if (!token) {
                                                                toast.info("Authentication required. Please sign in with Google.");
                                                                try {
                                                                    token = await authorizeDrive();
                                                                } catch (e) {
                                                                    return toast.error("Google authentication failed. Cannot test connection.");
                                                                }
                                                            }
                                                            
                                                            if (!token) return toast.error('Google authorization required for testing');

                                                            toast.loading('Testing Connection...', { id: 'test-sheet' });
                                                            try {
                                                                const { syncToGoogleSheets } = await import('../../services/sheetService');
                                                                // Try to append a test row
                                                                await syncToGoogleSheets(
                                                                    settings.googleSheetId, 
                                                                    ['CONNECTION_TEST', user?.email || 'N/A', new Date().toISOString()],
                                                                    'System_Test'
                                                                );
                                                                toast.success('Connection successful! Test row added to Sheet.', { id: 'test-sheet' });
                                                            } catch (e: any) {
                                                                console.error("Test failed", e);
                                                                const errMsg = e.message || 'Connection failed';
                                                                const gcpLink = errMsg.match(/https:\/\/console\.developers\.google\.com\/apis\/api\/sheets\.googleapis\.com\/overview\?project=\d+/)?.[0];
                                                                
                                                                if (gcpLink) {
                                                                    toast.error('Google Sheets API is disabled', {
                                                                        id: 'test-sheet',
                                                                        description: 'You must enable it in Google Cloud Console before use.',
                                                                        duration: 15000,
                                                                        action: {
                                                                            label: 'Enable Now',
                                                                            onClick: () => window.open(gcpLink, '_blank')
                                                                        }
                                                                    });
                                                                } else if (errMsg.includes('Google Sheet not found')) {
                                                                    toast.error('Google Sheet not found', {
                                                                        id: 'test-sheet',
                                                                        description: 'Please check your Sheet Target ID.',
                                                                        duration: 5000
                                                                    });
                                                                } else if (errMsg.includes('Authentication required')) {
                                                                    toast.error('Authentication Error', { 
                                                                        id: 'test-sheet', 
                                                                        description: 'Session might have expired. Please try again to re-authenticate.',
                                                                        duration: 5000
                                                                    });
                                                                } else {
                                                                    toast.error(errMsg, { id: 'test-sheet', duration: 10000 });
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        Test Connection
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        type="button"
                                                        size="sm" 
                                                        className="h-6 text-[0.65rem] px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                                        onClick={async () => {
                                                            toast.loading('Creating Google Sheet...', { id: 'create-sheet' });
                                                            try {
                                                                const { googleManager } = await import('../../services/GoogleWorkspaceManager');
                                                                const response = await googleManager.callAPI('https://sheets.googleapis.com/v4/spreadsheets', {
                                                                    method: 'POST',
                                                                    headers: {
                                                                        'Content-Type': 'application/json'
                                                                    },
                                                                    body: JSON.stringify({
                                                                        properties: { title: 'OilGas_CV_Management_Database' },
                                                                        sheets: [{ properties: { title: 'Approved_Candidates' } }]
                                                                    })
                                                                });
                                                                
                                                                const data = await response.json();
                                                                setSettings(s => s ? ({ ...s, googleSheetId: data.spreadsheetId, autoBackupEnabled: true }) : null);
                                                                toast.success('Sheet created and connected!', { id: 'create-sheet' });
                                                            } catch (e: any) {
                                                                console.error("Sheet creation failed", e);
                                                                if (e.message?.includes('Authentication required')) {
                                                                    toast.error('Authentication Required', {
                                                                        id: 'create-sheet',
                                                                        description: 'Please click "Connect Google Account" or sign in again to grant permissions.'
                                                                    });
                                                                    if (authorizeDrive) await authorizeDrive();
                                                                } else {
                                                                    toast.error('Creation failed: ' + e.message, { id: 'create-sheet' });
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        Auto-Create
                                                    </Button>
                                                </div>
                                            </div>
                                            <Input 
                                                name="sheetId" 
                                                placeholder="Paste Google Sheet ID here..." 
                                                value={settings?.googleSheetId || ''}
                                                onChange={(e) => setSettings(s => s ? ({...s, googleSheetId: e.target.value}) : null)}
                                                className="h-9 text-[0.85rem] border-slate-200 bg-slate-50"
                                            />
                                        </div>

                                        <div className="pt-2 flex items-center justify-between p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                                            <div className="flex flex-col">
                                                <span className="text-[0.78rem] font-bold text-indigo-900">Auto Backup & Synchronization</span>
                                                <span className="text-[0.65rem] text-indigo-600 font-medium">Export approved data to Google Sheets automatically</span>
                                            </div>
                                            <div 
                                                className={`w-10 h-5 rounded-full p-1 cursor-pointer transition-colors ${settings?.autoBackupEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                                onClick={() => setSettings(s => s ? ({ ...s, autoBackupEnabled: !s.autoBackupEnabled }) : null)}
                                            >
                                                <div className={`w-3 h-3 bg-white rounded-full transition-transform ${settings?.autoBackupEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </div>
                                        </div>
                                        
                                        <Button type="submit" className="w-full bg-gradient-to-br from-indigo-600 to-violet-600 font-bold h-10 mt-2 shadow-md hover:shadow-lg transition-all rounded-xl">
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                            Save Settings Securely
                                        </Button>
                                    </>
                                    )}
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] bg-white rounded-2xl overflow-hidden">
                        <CardHeader className="border-b border-slate-100/50 py-4 px-6 flex flex-row items-center justify-between">
                            <CardTitle className="text-[0.9rem] font-bold flex items-center gap-2 text-slate-800">
                                <Database className="w-4 h-4 text-red-500" />
                                Backup & Records
                            </CardTitle>
                            {settings?.autoBackupEnabled && (
                                <Badge variant="outline" className="text-[0.65rem] bg-indigo-50 text-indigo-700 border-indigo-100">Live Syncing</Badge>
                            )}
                        </CardHeader>
                        <CardContent className="p-6 space-y-3">
                            <Button 
                                variant="outline" 
                                className="w-full justify-start text-[0.85rem] h-9 border-slate-200 hover:border-indigo-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                onClick={async () => {
                                    if (!settings?.googleSheetId) return toast.error('Check Sheets integration');
                                    
                                    try {
                                        toast.loading('Starting global recovery snapshot...', { id: 'backup' });
                                        const { collection, getDocs, query, where } = await import('firebase/firestore');
                                        const { syncToGoogleSheets } = await import('../../services/sheetService');
                                        
                                        let q;
                                        if (profile?.role === 'Admin') {
                                            q = collection(db, 'candidates');
                                        } else {
                                            q = query(collection(db, 'candidates'), where('ownerId', '==', user!.uid));
                                        }
                                        
                                        const snap = await getDocs(q);
                                        const experts = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
                                        
                                        for (const exp of experts) {
                                            await syncToGoogleSheets(
                                                settings.googleSheetId!,
                                                [
                                                    exp.id,
                                                    exp.candidateName,
                                                    exp.discipline,
                                                    exp.specializedField,
                                                    exp.yearsExp,
                                                    exp.aiScore,
                                                    exp.currentStatus,
                                                    new Date().toISOString()
                                                ],
                                                `Global_Backup_${new Date().toISOString().split('T')[0]}`
                                            );
                                        }
                                        
                                        toast.success('Global backup completed successfully', { id: 'backup' });
                                    } catch (err: any) {
                                        if (err.message && err.message.includes('Google Sheet not found')) {
                                            toast.error('Backup failed: Google Sheet not found.', { id: 'backup' });
                                        } else if (err.message && err.message.includes('AUTH_REQUIRED')) {
                                            toast.error('Backup failed: Google authentication required.', { id: 'backup' });
                                        } else {
                                            console.error(err);
                                            toast.error('Backup failed: ' + err.message, { id: 'backup' });
                                        }
                                    }
                                }}
                            >
                                <Cloud className="w-4 h-4 mr-2" /> Force Global Cloud Backup
                            </Button>
                            <Button variant="outline" className="w-full justify-start text-[0.85rem] h-9 border-slate-200 hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors" onClick={async () => {
                                const { generateUserGuide } = await import('../../services/userGuideService');
                                await generateUserGuide();
                                toast.success('User Guide Downloaded');
                            }}>
                                <FileText className="w-4 h-4 mr-2" /> Download User Manual
                            </Button>
                            
                            {profile?.role === 'Admin' && (
                                <div className="pt-2">
                                    <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-red-800 text-[0.75rem] font-medium mb-3">
                                        <ShieldAlert className="w-4 h-4 inline mr-1 -mt-0.5" />
                                        Warning: Below actions directly modify all databases and may wipe current data. Only for administrators.
                                    </div>
                                    <Button variant="outline" className="w-full justify-start text-[0.85rem] h-9 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors">
                                        <Trash2 className="w-4 h-4 mr-2" /> Clear All System Data
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {profile?.role === 'Admin' && (
                        <Card className="border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] bg-white rounded-2xl overflow-hidden">
                            <CardHeader className="border-b border-slate-100/50 py-4 px-6">
                                <CardTitle className="text-[0.9rem] font-bold flex items-center gap-2 text-slate-800">
                                    <Users className="w-4 h-4 text-primary" />
                                    User Management
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <UserManagementSection />
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

// Sub-component to encapsulate user fetching and updating logic
const UserManagementSection = () => {
    const [users, setUsers] = useState<UserSettings[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            const path = 'settings';
            try {
                const { collection, getDocs } = await import('firebase/firestore');
                const snap = await getDocs(collection(db, path));
                setUsers(
                    snap.docs
                        .filter(d => d.id !== 'system_config')
                        .map(d => ({ ...d.data(), userId: d.id } as UserSettings))
                );
            } catch (e) {
                handleFirestoreError(e, OperationType.GET, path);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    const handleRoleChange = async (userId: string, newRole: string) => {
        const path = `settings/${userId}`;
        try {
            const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
            await updateDoc(doc(db, 'settings', userId), { role: newRole, updatedAt: serverTimestamp() });
            setUsers(users.map(u => u.userId === userId ? { ...u, role: newRole as any } : u));
            toast.success("Role updated");
        } catch (e) {
            handleFirestoreError(e, OperationType.UPDATE, path);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><p className="text-sm text-slate-400 font-medium italic animate-pulse">Loading IAM records...</p></div>;

    return (
        <div className="space-y-3">
            {users.map(u => (
                <div key={u.userId} className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 uppercase shrink-0">
                        {u.userName?.charAt(0) || u.email?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 overflow-hidden w-full text-center sm:text-left">
                        <p className="font-bold text-sm text-slate-800 truncate">{u.userName || 'Unknown User'}</p>
                        <p className="text-xs font-medium text-slate-500 truncate">{u.email}</p>
                    </div>
                    <select 
                        className="bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 shrink-0 w-full sm:w-auto shadow-sm"
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.userId, e.target.value)}
                    >
                        <option value="Admin">Admin</option>
                        <option value="Recruiter">Recruiter</option>
                        <option value="Viewer">Viewer</option>
                    </select>
                </div>
            ))}
        </div>
    );
};
