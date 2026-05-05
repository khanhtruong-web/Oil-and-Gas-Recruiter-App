import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { useDisciplines } from './hooks/useDisciplines';
import { 
  Users, 
  LayoutDashboard, 
  FileUp, 
  Settings as SettingsIcon,
  LogOut,
  PlusCircle,
  FileSearch,
  Database,
  ExternalLink,
  Loader2,
  FolderTree,
  Building2,
  Bot,
  TrendingUp,
  Award,
  CheckCircle2,
  Trash2,
  Search,
  BarChart3,
  Clock,
  Maximize,
  Minimize,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, getDocs, setDoc, orderBy, limit, getDoc } from 'firebase/firestore';
import { db, auth } from './lib/firebase';
import { Candidate, UserSettings, CandidateStatus, ActivityLog, UserRole } from './types';
import { Toaster, toast } from 'sonner';
import { ChatBox } from './components/ChatBox';
import { geminiService } from './services/geminiService';
import { listDriveFiles, findOrCreateFolder, moveFile, uploadFileToDrive } from './services/driveService';
import { syncToGoogleSheets } from './services/sheetService';
import { exportToWord } from './services/docxService';
import { extractTextFromPdf } from './services/pdfService';
import { extractTextFromDocx } from './services/docxParserService';
import { processSyncQueue } from './services/offlineSyncService';
import { googleManager } from './services/GoogleWorkspaceManager';
import { CompanyTemplates } from './components/views/CompanyTemplates';
import { SmartSearch } from './components/views/SmartSearch';
import { FolderManagement } from './components/views/FolderManagement';
import { AITools } from './components/views/AITools';
import { CVExtraction } from './components/views/CVExtraction';
import { PersonnelDirectory } from './components/views/PersonnelDirectory';
import { Dashboard } from './components/views/Dashboard';
import { Settings } from './components/views/Settings';
import { ReportsView } from './components/views/ReportsView';
import { Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { OperationType, handleFirestoreError } from './lib/firestore-error';
import { getSafeDisciplineFolderName, getApprovedFileName } from './lib/drive-utils';

// --- COMPONENTS ---

const LoginPage = () => {
  const { signIn, isSigningIn, error, clearError } = useAuth();
  
  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4 font-sans relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
      
      <Card className="w-full max-w-md shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border-white/5 bg-white/95 backdrop-blur-sm animate-in zoom-in-95 duration-700 rounded-[2.5rem] overflow-hidden relative">
        <div className="h-1.5 bg-gradient-to-r from-primary via-blue-400 to-primary w-full" />
        <CardHeader className="text-center space-y-6 pt-12 pb-6">
          <div className="mx-auto bg-slate-900 ring-8 ring-slate-100 p-5 rounded-[2rem] w-fit shadow-xl">
            <Users className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-4xl font-black tracking-tighter text-slate-900">Recruitment Expert</CardTitle>
            <CardDescription className="text-primary font-black uppercase text-[11px] tracking-[0.2em] mt-1">
              Oil & Gas • Offshore • Global HR
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-10 pb-12 space-y-8">
          {error && (
            <div className={`p-5 rounded-2xl text-sm animate-in fade-in slide-in-from-top-1 border transition-all ${
              error.includes('chưa được cấp phép') || error.includes('unauthorized-domain')
                ? 'bg-amber-50 border-amber-200 text-amber-800' 
                : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <div className="bg-current/10 p-1.5 rounded-lg">
                    <LogOut className="w-4 h-4 rotate-180" />
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-black uppercase text-[10px] tracking-widest opacity-70">
                      System Notification
                    </p>
                    <button onClick={clearError} className="opacity-40 hover:opacity-100 transition-all p-1">
                      <PlusCircle className="w-4 h-4 rotate-45" />
                    </button>
                  </div>
                  <p className="font-bold leading-tight">{error}</p>
                  
                  <div className="mt-4 p-3 bg-white/60 rounded-xl space-y-2 border border-current/10">
                    <p className="text-[10px] font-black uppercase text-slate-500">Troubleshooting Details:</p>
                    <div className="text-[11px] font-mono break-all opacity-80 space-y-1">
                      <div className="flex gap-2">
                        <span className="font-bold shrink-0">Domain:</span>
                        <span>{window.location.hostname}</span>
                      </div>
                      <p className="mt-2 text-[10px] font-sans leading-relaxed">
                        💡 **OAuth Critical Setup:**<br/>
                        1. **Firebase Console:** Add Domain to *Authorized Domains*.<br/>
                        2. **GCP Console:** Add BOTH of these URLs to *Authorized Redirect URIs*:<br/>
                           <div className="font-mono bg-white/10 px-2 py-1 rounded text-[8.5px] mt-1 mb-1 select-all border border-white/5">https://gen-lang-client-0648025381.firebaseapp.com/__/auth/handler</div>
                           <div className="font-mono bg-white/10 px-2 py-1 rounded text-[8.5px] mt-1 mb-1 select-all border border-white/5">{window.location.origin}/auth/callback</div>
                        3. **Still getting 400 error?** Click **"error details"** on Google 400 page to see the exact URI Google is receiving. Copy it exactly into GCP *Authorized Redirect URIs* (including protocol).<br/>
                        4. **Popup Closed:** Usually means the window was closed before finishing (often after seeing the error 400).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <Button 
              className="w-full h-16 text-lg font-black shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-[0.98] bg-slate-900 text-white rounded-2xl border-none group relative overflow-hidden" 
              onClick={signIn}
              disabled={isSigningIn}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              {isSigningIn ? (
                <>
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Users className="w-6 h-6 mr-3 text-primary group-hover:scale-110 transition-transform" />
                  Sign in with Google
                </>
              )}
            </Button>
            
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center px-4"><span className="w-full border-t border-slate-100"></span></div>
              <div className="relative flex justify-center text-[10px] uppercase font-black tracking-[0.3em]"><span className="bg-white/95 px-4 text-slate-400">Environment Protocol</span></div>
            </div>

            <Button 
              variant="outline"
              className="w-full h-14 text-sm font-black border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600 rounded-2xl flex items-center justify-center gap-3 transition-all uppercase tracking-wider"
              onClick={openInNewTab}
            >
              <ExternalLink className="w-4 h-4 text-primary" />
              Open in New Tab
            </Button>
          </div>

          <div className="text-center pt-2">
            <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
               Enterprise Secure Sync Active
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};



const ExpertCatalog = ({ candidates, onUpdateStatus, onDelete }: { 
  candidates: Candidate[], 
  onUpdateStatus: (id: string, status: CandidateStatus) => void,
  onDelete: (id: string) => void
}) => {
  const [filter, setFilter] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('All');
  const { profile } = useAuth();
  const { disciplines: DISCIPLINE_CATALOG } = useDisciplines();
  const canEdit = profile?.role === 'Admin' || profile?.role === 'Recruiter';

  const filtered = candidates.filter(c => {
    const matchesSearch = c.candidateName.toLowerCase().includes(filter.toLowerCase()) || 
                         c.specializedField?.toLowerCase().includes(filter.toLowerCase()) ||
                         c.workFields?.toLowerCase().includes(filter.toLowerCase());
    const matchesDiscipline = disciplineFilter === 'All' || c.discipline === disciplineFilter;
    return matchesSearch && matchesDiscipline;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div className="flex-1 space-y-1.5 font-sans">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1 flex items-center gap-1.5">
            <Search className="w-3 h-3" />
            Search Catalog
          </label>
          <Input 
            placeholder="Search by name, specialization, or domains..." 
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-slate-50 border-none focus-visible:ring-primary/20 h-10 font-medium"
          />
        </div>
        <div className="w-full md:w-[250px] space-y-1.5">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Primary Discipline</label>
          <Select value={disciplineFilter} onValueChange={setDisciplineFilter}>
            <SelectTrigger className="bg-slate-50 border-none focus-visible:ring-primary/20 h-10 font-bold">
              <SelectValue placeholder="All Disciplines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Disciplines</SelectItem>
              {DISCIPLINE_CATALOG.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="font-black text-slate-500 text-[10px] uppercase tracking-widest py-4">Candidate Expert</TableHead>
              <TableHead className="font-black text-slate-500 text-[10px] uppercase tracking-widest py-4">Discipline / Fields</TableHead>
              <TableHead className="font-black text-slate-500 text-[10px] uppercase tracking-widest py-4">Exp (Y)</TableHead>
              <TableHead className="font-black text-slate-500 text-[10px] uppercase tracking-widest py-4">AI suitability</TableHead>
              <TableHead className="font-black text-slate-500 text-[10px] uppercase tracking-widest py-4">Status & Access</TableHead>
              <TableHead className="text-right font-black text-slate-500 text-[10px] uppercase tracking-widest py-4 pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors border-slate-50">
                <TableCell className="py-4">
                  <div className="font-bold text-slate-800 text-sm">{c.candidateName}</div>
                  <div className="text-[10px] text-slate-400 font-bold tracking-tight mt-0.5">
                    {c.email && <span>{c.email}</span>}
                    {c.email && c.phone && <span> • </span>}
                    {c.phone && <span>{c.phone}</span>}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">{c.specializedField}</div>
                </TableCell>
                <TableCell className="py-4">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[9px] font-black uppercase bg-indigo-50 text-indigo-700 border-none px-1.5 h-5 flex items-center">
                        {c.discipline}
                    </Badge>
                  </div>
                  <div className="text-[9px] text-slate-400 mt-1 max-w-[150px] truncate font-medium">{c.workFields}</div>
                </TableCell>
                <TableCell className="py-4 font-black text-slate-600 tabular-nums">{c.yearsExp}</TableCell>
                <TableCell className="py-4">
                    {c.aiScore ? (
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <div className="text-[10px] font-black tabular-nums">{c.aiScore}%</div>
                                <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden w-12">
                                    <div className="h-full bg-emerald-500" style={{ width: `${c.aiScore}%` }} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <span className="text-[10px] text-slate-300 font-bold italic tracking-tight">Not evaluated</span>
                    )}
                </TableCell>
                <TableCell className="py-4">
                  <div className="flex items-center gap-2">
                      <Select 
                        disabled={!canEdit}
                        value={c.currentStatus} 
                        onValueChange={(val) => onUpdateStatus(c.id!, val as CandidateStatus)}
                      >
                        <SelectTrigger className="w-[120px] border-slate-200 bg-white h-8 font-bold text-[10px] uppercase">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="font-black text-[10px] uppercase">
                          <SelectItem value="New">New</SelectItem>
                          <SelectItem value="Reviewing">Reviewing</SelectItem>
                          <SelectItem value="Shortlisted">Shortlisted</SelectItem>
                          <SelectItem value="Rejected">Rejected</SelectItem>
                          <SelectItem value="Hired">Hired</SelectItem>
                        </SelectContent>
                      </Select>
                      {c.driveFileUrl && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-blue-600 bg-blue-50" onClick={() => window.open(c.driveFileUrl, '_blank')}>
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                  </div>
                </TableCell>
                <TableCell className="text-right py-4 pr-6">
                    <div className="flex items-center justify-end gap-1">
                        <Dialog>
                            <DialogTrigger>
                                <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase text-slate-400 hover:text-primary">
                                    Analyze
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                                <CVAnalysisTool candidate={c} />
                            </DialogContent>
                        </Dialog>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-[10px] font-black uppercase text-slate-400 hover:text-primary"
                            onClick={() => exportToWord(c, 'Standard Company Format')}
                        >
                            Export
                        </Button>
                        {canEdit && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                    onDelete(c.id!);
                                }}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-24 text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                      <Search className="w-8 h-8 opacity-20" />
                      <p className="italic font-medium">No candidates matching your query.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

const CVAnalysisTool = ({ candidate }: { candidate: Candidate }) => {
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);

    const runAnalysis = async (mode: 'spellcheck' | 'review' | 'suggest') => {
        if (!candidate.rawText) return toast.error('CV source text missing');
        setLoading(true);
        try {
            const res = await geminiService.analyzeCV(candidate.rawText, mode);
            setResult(res);
        } catch (e) {
            toast.error('AI Analysis failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 py-4">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-black">
                    <Bot className="w-6 h-6 text-primary" />
                    AI Expert Intelligence
                </DialogTitle>
                <div className="text-sm font-medium text-slate-400">
                    Analyze <span className="text-slate-800 font-bold">{candidate.candidateName}</span> using Gemini Pro models.
                </div>
            </DialogHeader>

            <div className="flex flex-wrap gap-2 pt-2">
                {[
                    { id: 'spellcheck', label: 'Spellcheck', icon: CheckCircle2, color: 'bg-blue-50 text-blue-700' },
                    { id: 'review', label: 'Suitability Review', icon: Award, color: 'bg-indigo-50 text-indigo-700' },
                    { id: 'suggest', label: 'Improvement Tips', icon: TrendingUp, color: 'bg-emerald-50 text-emerald-700' },
                ].map(tool => (
                    <Button 
                        key={tool.id}
                        variant="outline" 
                        size="sm" 
                        className={`font-black text-[10px] uppercase border-none ${tool.color} h-9 px-4`}
                        onClick={() => runAnalysis(tool.id as any)}
                        disabled={loading}
                    >
                        <tool.icon className="w-3.5 h-3.5 mr-2" />
                        {tool.label}
                    </Button>
                ))}
            </div>

            <div className="min-h-[300px] max-h-[500px] overflow-y-auto bg-slate-50 rounded-xl p-6 border-2 border-slate-100 font-sans leading-relaxed text-sm">
                {loading ? (
                    <div className="flex flex-col items-center justify-center pt-20 gap-3 text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <p className="font-bold text-[10px] uppercase tracking-widest">Generating Insight...</p>
                    </div>
                ) : result ? (
                    <div className="whitespace-pre-wrap text-slate-700 font-medium whitespace-pre-wrap">{result}</div>
                ) : (
                    <div className="flex flex-col items-center justify-center pt-20 text-slate-300 italic">
                        Select an analysis mode to begin AI review.
                    </div>
                )}
            </div>
        </div>
    );
};

const ImportExpert = ({ onExpertAdded }: { onExpertAdded: (c: Partial<Candidate>, driveFileId?: string) => void }) => {
  const [loading, setLoading] = useState(false);
  const [cvText, setCvText] = useState('');
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [fetchingFiles, setFetchingFiles] = useState(false);
  const [parsedCandidate, setParsedCandidate] = useState<Partial<Candidate> | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | undefined>(undefined);
  const { accessToken, user, profile, refreshTokenSilently } = useAuth();
  const { disciplines: DISCIPLINE_CATALOG } = useDisciplines();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  
  const canUpload = profile?.role === 'Admin' || profile?.role === 'Recruiter';

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
    }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings');
    });

    const unsubSystem = onSnapshot(doc(db, 'settings', 'system_config'), (d) => {
        if (d.exists()) {
            currentSystemConfig = d.data();
            updateSettingsData();
        }
    }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings/system_config');
    });

    return () => {
        unsubUser();
        unsubSystem();
    };
  }, [user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const text = await extractTextFromPdf(file);
        setCvText(text);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
        const text = await extractTextFromDocx(file);
        setCvText(text);
      } else {
        toast.error('Only PDF and DOCX files are supported.');
      }
    } catch (err: any) {
      toast.error('Failed to parse file: ' + err.message);
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset input
    }
  };

  const loadDriveFiles = async () => {
    if (!settings?.driveRootFolderId || settings.driveRootFolderId.includes('.apps.google')) return;
    setFetchingFiles(true);
    try {
      const { listDriveFiles } = await import('./services/driveService');
      const files = await listDriveFiles(settings.driveRootFolderId);
      setDriveFiles(files);
    } catch (e: any) {
      if (e.message?.includes('AUTH_REQUIRED')) {
        console.warn("[App] Drive access requires authorization. Silence error toast.");
      } else {
        toast.error('Gặp lỗi khi tải files từ Drive: ' + e.message);
      }
    } finally {
      setFetchingFiles(false);
    }
  };

  const handleParse = async (text?: string, fileId?: string) => {
    const content = text || cvText;
    if (!content.trim()) return toast.error('Please paste CV text or select a file.');
    setLoading(true);
    setActiveFileId(fileId);
    try {
      if (!geminiService['ai']) {
          const sysDoc = await getDoc(doc(db, 'settings', 'system_config'));
          if (sysDoc.exists() && sysDoc.data().geminiApiKey) {
              geminiService.setApiKey(sysDoc.data().geminiApiKey);
          } else if (settings?.geminiApiKey) {
              geminiService.setApiKey(settings.geminiApiKey);
          }
      }
      const data = await geminiService.parseCV(content);
      setParsedCandidate(data);
      toast.success('AI parsed CV successfully!');
    } catch (e: any) {
      toast.error('AI Parsing failed: ' + (e?.message || ''));
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (parsedCandidate) {
      onExpertAdded(parsedCandidate, activeFileId);
      setParsedCandidate(null);
      setCvText('');
      setActiveFileId(undefined);
    }
  };

  if (!canUpload) {
    return (
        <div className="flex flex-col items-center justify-center pt-24 space-y-4">
            <Bot className="w-16 h-16 text-slate-200" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Access to Import is Restricted</p>
        </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-md overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-6">
              <CardTitle className="text-xl font-black flex items-center gap-2">
                <FileUp className="w-6 h-6 text-primary" />
                Expert Profile Decipher
              </CardTitle>
              <CardDescription className="text-slate-500 font-semibold uppercase text-[9px] tracking-widest">Feed the AI global expertise data</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <textarea 
                  className="w-full min-h-[350px] p-4 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-primary/20 text-sm font-medium transition-all outline-none resize-none text-slate-700"
                  placeholder="Paste CV text here..."
                  value={cvText}
                  onChange={e => setCvText(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <label className="flex-1 cursor-pointer">
                  <Input type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileUpload} />
                  <div className="w-full h-12 flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-200 text-slate-500 font-bold hover:border-primary hover:text-primary transition-colors text-sm">
                    <FileUp className="w-4 h-4" />
                    Upload PDF / DOCX
                  </div>
                </label>
                <Button 
                    onClick={() => handleParse()} 
                    disabled={loading || !cvText.trim()} 
                    className="flex-1 h-12 text-md font-black shadow-lg shadow-primary/10"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Deconstructing CV...
                    </>
                  ) : (
                      <>
                        <Bot className="w-5 h-5 mr-2" />
                        AI Extraction Command
                      </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-md h-full min-h-[400px] flex flex-col">
            <CardHeader className="bg-blue-600 text-white">
              <CardTitle className="text-sm font-black flex items-center justify-between">
                <div className="flex items-center gap-2 uppercase tracking-widest text-[10px]">
                  <Database className="w-4 h-4" />
                  G-Drive Workspace
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-black text-blue-100 hover:text-white" onClick={loadDriveFiles}>
                   Sync
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-1">
              {!settings?.driveRootFolderId ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-4">
                  <FolderTree className="w-12 h-12 text-slate-200" />
                  <p className="text-xs text-slate-400 font-bold">No root folder linked.</p>
                </div>
              ) : fetchingFiles ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Scanning...</span>
                </div>
              ) : driveFiles.length === 0 ? (
                <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-300 py-10 italic">Empty Folder.</p>
              ) : (
                <ScrollArea className="h-[450px]">
                  <div className="space-y-2 pr-4">
                    {driveFiles.map((file) => (
                      <div 
                        key={file.id} 
                        className="p-3 rounded-xl border border-slate-100 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group"
                        onClick={() => {
                            setCvText(`[FILE: ${file.name}]\n...`);
                            handleParse(`Professional CV for candidate candidate from ${file.name}.`, file.id);
                        }}
                      >
                        <p className="text-sm font-bold text-slate-700 truncate">{file.name}</p>
                        <div className="flex items-center justify-between mt-1 text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                            <span>{file.mimeType.split('.').pop()}</span>
                            <ExternalLink className="w-3 h-3 group-hover:text-primary transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {parsedCandidate && (
        <Card className="border-4 border-emerald-500/10 shadow-2xl animate-in zoom-in-95 duration-500 bg-emerald-50/5 overflow-hidden">
          <CardHeader className="bg-emerald-600 text-white py-6">
            <CardTitle className="text-xl font-black italic tracking-tighter uppercase">AI Agent Validation Step</CardTitle>
            <CardDescription className="text-emerald-100 font-bold uppercase text-[10px] tracking-widest">Confirm inferred specialist credentials</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Name</label>
                    <Input className="h-11 font-bold bg-white text-lg" value={parsedCandidate.candidateName || ''} onChange={e => setParsedCandidate({...parsedCandidate, candidateName: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Primary Sector</label>
                    <Select value={parsedCandidate.discipline || ''} onValueChange={(val) => setParsedCandidate({...parsedCandidate, discipline: val})}>
                        <SelectTrigger className="h-11 font-bold bg-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            {DISCIPLINE_CATALOG.map(d => (
                                <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Tenure (Years)</label>
                    <Input type="number" className="h-11 font-bold bg-white text-lg tabular-nums" value={parsedCandidate.yearsExp ?? ''} onChange={e => setParsedCandidate({...parsedCandidate, yearsExp: Number(e.target.value)})} />
                </div>
                <div className="space-y-2 lg:col-span-full">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Operational Domains</label>
                    <Input className="h-11 font-bold bg-white" value={parsedCandidate.workFields || ''} onChange={e => setParsedCandidate({...parsedCandidate, workFields: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Email</label>
                    <Input className="h-11 font-bold bg-white" value={parsedCandidate.email || ''} onChange={e => setParsedCandidate({...parsedCandidate, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Phone</label>
                    <Input className="h-11 font-bold bg-white" value={parsedCandidate.phone || ''} onChange={e => setParsedCandidate({...parsedCandidate, phone: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Specialization</label>
                    <Input className="h-11 font-bold bg-white" value={parsedCandidate.specializedField || ''} onChange={e => setParsedCandidate({...parsedCandidate, specializedField: e.target.value})} />
                </div>
                <div className="lg:col-span-full pt-4 flex gap-4">
                    <Button variant="outline" className="flex-1 h-14 font-black uppercase tracking-widest text-xs border-slate-200" onClick={() => setParsedCandidate(null)}>Discard</Button>
                    <Button className="flex-[2] h-14 bg-emerald-600 hover:bg-emerald-700 font-black text-lg shadow-xl shadow-emerald-200" onClick={handleSave}>
                        INDEX TO DATABASE
                    </Button>
                </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const PersonnelCatalog = ({ candidates }: { candidates: Candidate[] }) => {
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'Admin';
    const [userSettings, setUserSettings] = useState<UserSettings[]>([]);

    useEffect(() => {
        if (!isAdmin) return;
        const q = query(collection(db, 'settings'), limit(50));
        return onSnapshot(q, (snap) => {
            const users = snap.docs.map(doc => doc.data() as UserSettings);
            setUserSettings(users);
        }, (error) => {
            handleFirestoreError(error, OperationType.LIST, 'settings');
        });
    }, [isAdmin]);

    const updateRole = async (userId: string, role: UserRole) => {
        if (!isAdmin) return;
        try {
            await updateDoc(doc(db, 'settings', userId), { role, updatedAt: serverTimestamp() });
            toast.success(`Role updated`);
        } catch (e) {
            handleFirestoreError(e, OperationType.UPDATE, `settings/${userId}`);
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="border-none shadow-sm md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" />
                            Global Experts Directory
                        </CardTitle>
                        <CardDescription>Consolidated list of shortlisted and hired personnel.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[450px]">
                            <div className="space-y-3 pr-4">
                                {candidates.filter(c => c.currentStatus === 'Hired' || c.currentStatus === 'Shortlisted').map((c, i) => (
                                    <div key={i} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between hover:border-primary/20 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400">
                                                {c.candidateName.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm leading-tight">{c.candidateName}</p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{c.discipline}</p>
                                            </div>
                                        </div>
                                        <Badge className={`${c.currentStatus === 'Hired' ? 'bg-emerald-500' : 'bg-indigo-500'} font-black text-[9px] uppercase tracking-widest`}>
                                            {c.currentStatus}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {isAdmin && (
                    <Card className="border-none shadow-sm">
                        <CardHeader className="bg-slate-900 text-white rounded-t-xl">
                            <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest">
                                <SettingsIcon className="w-4 h-4" />
                                Staff Access Controls
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <ScrollArea className="h-[430px]">
                                <div className="space-y-4 pr-4">
                                    {userSettings.map((u, i) => (
                                        <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm truncate">{u.userName}</p>
                                                <p className="text-[10px] font-medium text-slate-400 truncate">{u.email}</p>
                                            </div>
                                            <Select value={u.role} onValueChange={(val) => updateRole(u.userId, val as UserRole)}>
                                                <SelectTrigger className="w-full h-8 text-[10px] font-black uppercase bg-white border-slate-200">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="font-black text-[10px] uppercase">
                                                    <SelectItem value="Admin">Admin</SelectItem>
                                                    <SelectItem value="Recruiter">Recruiter</SelectItem>
                                                    <SelectItem value="Viewer">Viewer</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}





const SessionTracker = () => {
    const { refreshTokenSilently } = useAuth();
    const [elapsed, setElapsed] = useState(0);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [syncCount, setSyncCount] = useState(0);
    const [syncPulse, setSyncPulse] = useState(false);

    useEffect(() => {
        const startTime = Date.now();
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        
        const handleOnline = () => {
            setIsOnline(true);
            processSyncQueue();
        };
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial process queue check
        if (navigator.onLine) {
            processSyncQueue();
        }

        const handleSync = (e: Event) => {
            setLastSync(new Date());
            setSyncCount(c => c + 1);
            setSyncPulse(true);
            setTimeout(() => setSyncPulse(false), 2000);
            
            // Custom detail handling if 'app-data-sync' passes detail
            const customEvent = e as CustomEvent;
            if (customEvent.detail?.type) {
                // Could display what synced here if needed
            }
        };
        window.addEventListener('app-data-sync', handleSync);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('app-data-sync', handleSync);
        };
    }, []);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const pad = (v: number) => v.toString().padStart(2, '0');
        if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
        return `${pad(m)}:${pad(s)}`;
    };

    const handleManualSync = () => {
        toast.promise(
            async () => {
                await processSyncQueue();
                if (navigator.onLine) {
                    window.dispatchEvent(new CustomEvent('app-data-sync', { detail: { type: 'manual_ping' } }));
                } else {
                    throw new Error('You are currently offline. Background sync will execute when connection returns.');
                }
            },
            {
                loading: 'Verifying real-time connection...',
                success: 'Firebase Real-time Data Synced. Consistent across all accounts & devices.',
                error: (err: any) => err.message || 'Offline'
            }
        );
    }

    return (
        <div className="bg-white/90 backdrop-blur-sm p-1.5 rounded-xl shadow-sm border flex gap-3 items-center transition-all duration-300">
            <div className="px-3 py-1.5 text-[11px] font-bold border-r border-slate-200 text-slate-500 uppercase tracking-wider flex items-center gap-2" title="Tracking active connection">
                <Clock className="w-3.5 h-3.5 text-slate-400 transition-colors" />
                <span className="tabular-nums">Session: {formatTime(elapsed)}</span>
            </div>
            
            <div className="flex items-center gap-4 px-2">
                <div className={`flex items-center gap-2 text-[11px] uppercase font-bold tracking-wider transition-colors ${isOnline ? 'text-slate-600' : 'text-slate-400'}`}>
                    <div className="relative flex h-2.5 w-2.5">
                      {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                      <span className={`relative inline-flex rounded-full w-2.5 h-2.5 ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                    </div>
                    {isOnline ? 'Online' : 'Offline'}
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 border-l border-slate-200 pl-4 pr-1">
                    <div className={`relative flex items-center justify-center transition-all ${syncPulse ? 'text-primary scale-110' : 'text-slate-400'}`}>
                       <Database className="w-3.5 h-3.5" />
                       {syncPulse && <span className="absolute -inset-1 rounded-full bg-primary/20 animate-pulse"></span>}
                    </div>
                    <div className="flex flex-col leading-tight text-left">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            Live Syncs
                            {lastSync && <span className="text-[8px] lowercase font-medium opacity-70 ml-1">({lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})</span>}
                        </span>
                        <span className="text-primary tabular-nums text-[11px] transition-colors">
                            {syncCount} {syncCount === 1 ? 'Event' : 'Events'}
                        </span>
                    </div>
                </div>

                <div className="pl-2 border-l border-slate-200">
                    <Button 
                        variant="outline"
                        size="sm"
                        onClick={handleManualSync}
                        className="h-8 shadow-sm rounded-lg border-slate-200 text-slate-600 hover:text-primary hover:bg-slate-50 flex items-center gap-2"
                        title="Force check Google Sheet Sync & Database State"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Refresh Data</span>
                    </Button>
                </div>
            </div>
        </div>
    );
};

// --- APP ---

const MainContent = () => {
    const { user, profile, accessToken, logout, refreshTokenSilently, authorizeDrive } = useAuth();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [activities, setActivities] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => {
        if (!user) return;
        let currentUserSettings: any = null;
        let currentSystemConfig: any = null;

        const updateSettingsData = () => {
            if (!currentUserSettings) {
                // If user settings haven't loaded yet, just use system config
                setSettings({ ...currentSystemConfig } as UserSettings);
                return;
            }
            setSettings({ ...currentUserSettings, ...currentSystemConfig } as UserSettings);
        };

        const unsubUser = onSnapshot(doc(db, 'settings', user.uid), (d) => {
            if (d.exists()) {
                currentUserSettings = d.data();
                updateSettingsData();
            }
        }, (error) => {
            handleFirestoreError(error, OperationType.GET, `settings/${user.uid}`);
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

    // Use settings?.geminiApiKey to update Gemini API Key dynamically
    useEffect(() => {
        if (settings?.geminiApiKey) {
            console.log("Setting Gemini API key from settings.");
            geminiService.setApiKey(settings.geminiApiKey);
        } else if (profile?.geminiApiKey) {
            geminiService.setApiKey(profile.geminiApiKey);
        }
    }, [settings?.geminiApiKey, profile?.geminiApiKey]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                toast.error(`Error attempting to enable fullscreen mode: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => {
        const handleAuthRequired = () => {
             toast.error('Google account connection required or expired.', {
                 id: 'auth-required',
                 duration: 10000,
                 action: {
                     label: 'Connect',
                     onClick: async () => {
                         try {
                              if (authorizeDrive) {
                                  await authorizeDrive();
                                  toast.success("Connected Google services successfully.");
                                  import('./services/offlineSyncService').then(m => m.processSyncQueue());
                              }
                         } catch (e) {
                              toast.error("Connection failed.");
                         }
                     }
                 }
             });
        };
        window.addEventListener('auth-required', handleAuthRequired);
        return () => window.removeEventListener('auth-required', handleAuthRequired);
    }, [authorizeDrive]);

    useEffect(() => {
        if (!user || !profile) return;
        
        // All signed-in users have permission to read all candidates
        const q = collection(db, 'candidates');

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => {
                const data = doc.data();
                const convertDate = (val: any) => {
                    if (val === null || val === undefined) return '';
                    if (typeof val === 'string') return val;
                    // Handle Firestore Timestamp
                    if (val && typeof val === 'object' && typeof val.toMillis === 'function') {
                        return new Date(val.toMillis()).toISOString();
                    }
                    if (val instanceof Date) return val.toISOString();
                    // Fallback for objects that look like Timestamps but might not have methods (e.g. from cache)
                    if (val && typeof val === 'object' && typeof val.seconds === 'number') {
                        return new Date(val.seconds * 1000).toISOString();
                    }
                    return String(val || '');
                };
                return { 
                    ...data,
                    id: doc.id,
                    addedAt: convertDate(data.addedAt),
                    updatedAt: convertDate(data.updatedAt)
                };
            }) as Candidate[];
            setCandidates(list.sort((a, b) => {
                const getMs = (val: any) => {
                    if (!val) return 0;
                    if (typeof val === 'string') {
                        const d = new Date(val);
                        return isNaN(d.getTime()) ? 0 : d.getTime();
                    }
                    if (val && typeof val === 'object' && typeof val.toMillis === 'function') return val.toMillis();
                    if (val && typeof val === 'object' && typeof val.seconds === 'number') return val.seconds * 1000;
                    if (val instanceof Date) return val.getTime();
                    return 0;
                };
                return getMs(b.addedAt) - getMs(a.addedAt);
            }));
            setLoading(false);
            if (snapshot.docChanges().length > 0 && !snapshot.metadata.fromCache) {
               window.dispatchEvent(new CustomEvent('app-data-sync', { detail: { type: 'candidates' } }));
            }
        }, (error) => {
            handleFirestoreError(error, OperationType.LIST, 'candidates');
        });
        return () => unsubscribe();
    }, [user, profile]);

    useEffect(() => {
        if (!user || !profile) return;
        // Admins can see more history
        const logLimit = profile.role === 'Admin' ? 50 : 20;
        const q = query(collection(db, 'activities'), orderBy('timestamp', 'desc'), limit(logLimit));
        
        return onSnapshot(q, (snap) => {
            const logs = snap.docs.map(d => {
                const data = d.data();
                return {
                    ...data,
                    id: d.id,
                    // Ensure we handle serverTimestamp() being null initially
                    timestamp: data.timestamp ? (data.timestamp.toMillis ? data.timestamp.toDate() : new Date(data.timestamp)) : new Date()
                } as ActivityLog;
            });
            setActivities(logs);
            if (snap.docChanges().length > 0 && !snap.metadata.fromCache) {
                window.dispatchEvent(new CustomEvent('app-data-sync', { detail: { type: 'activities' } }));
            }
        }, (error) => {
            handleFirestoreError(error, OperationType.LIST, 'activities');
        });
    }, [user, profile]);

    const logActivity = async (text: string, type: string = 'general') => {
        const path = 'activities';
        try {
            await addDoc(collection(db, path), {
                userId: user!.uid,
                userName: profile?.userName || user!.displayName || 'User',
                text,
                type,
                timestamp: serverTimestamp()
            });
            if (accessToken && settings?.googleSheetId) {
                 import('./services/sheetService').then(m => {
                     m.logActivity(settings.googleSheetId, profile?.email || user!.email || 'Unknown', text, new Date().toISOString())
                      .catch(err => {
                          if (err.message.includes('Google Sheets API is disabled')) {
                              const gcpLink = err.message.match(/https:\/\/console\.developers\.google\.com\/apis\/api\/sheets\.googleapis\.com\/overview\?project=\d+/)?.[0];
                              toast.error('Google Sheets API is disabled', {
                                  id: 'sheets-disabled-log',
                                  description: 'Click to enable in Google Cloud Console',
                                  action: gcpLink ? {
                                      label: 'Enable',
                                      onClick: () => window.open(gcpLink, '_blank')
                                  } : undefined
                              });
                          }
                      });
                 });
            }
        } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, path);
        }
    };

    // Log login
    const hasLoggedLoginRef = React.useRef(false);
    useEffect(() => {
        if (user && profile && settings && accessToken && !hasLoggedLoginRef.current) {
            hasLoggedLoginRef.current = true;
            logActivity(`${profile?.email || user?.email} logged into the application`, 'login');
        }
    }, [user, profile, settings, accessToken]);

    const addCandidate = async (c: Partial<Candidate>, driveFileId?: string) => {
        try {
            console.log("AddCandidate start:", { c, driveFileId });
            let finalDriveUrl = c.driveFileUrl;
            let finalDriveId = driveFileId;
            
            let driveToken = accessToken;
            if (!driveToken && authorizeDrive) {
                try {
                    driveToken = await authorizeDrive();
                } catch(e) {
                    console.warn("Drive auth failed", e);
                }
            }
            
            // Step 1: Upload to Temp Folder (instead of discipline folder)
            let currentRootId = settings?.driveRootFolderId;
            if (driveToken && !currentRootId) {
                try {
                    toast.loading('Creating Drive Root Folder...', { id: 'drive-sync' });
                    const { findOrCreateFolder } = await import('./services/driveService');
                    currentRootId = await findOrCreateFolder('OilGas_CV_Management_2026', undefined);
                    if (currentRootId) {
                        await setDoc(doc(db, 'settings', user!.uid), { driveRootFolderId: currentRootId }, { merge: true });
                        toast.success('Drive Root Folder Auto-Created', { id: 'drive-sync' });
                    }
                } catch(e: any) {
                    toast.error('Could not auto-create root folder: ' + e.message, { id: 'drive-sync' });
                }
            }

            if (driveToken && currentRootId) {
                try {
                    let uploadNeeded = !driveFileId;
                    
                    if (uploadNeeded && c.fileUrl && c.fileUrl.startsWith('blob:')) {
                        toast.loading('Saving CV to Temporary Drive...', { id: 'drive-sync' });
                        // Create a temporary staging folder in the root
                        const { findOrCreateFolder } = await import('./services/driveService');
                        const tempFolderId = await findOrCreateFolder('_TEMP_CVS_PROCESSING', currentRootId);
                        
                        console.log("Uploading local file to Temp Drive folder:", c.fileUrl);
                        const blobRes = await fetch(c.fileUrl, { redirect: "follow" });
                        if (!blobRes.ok) throw new Error("Failed to fetch local blob");
                        const blob = await blobRes.blob();
                        const fileOb = new File([blob], c.fileName || 'CV Document', { type: c.fileType || 'application/pdf' });
                        const { uploadFileToDrive } = await import('./services/driveService');
                        const newDriveId = await uploadFileToDrive(fileOb, tempFolderId, c.fileName);
                        
                        if (newDriveId) {
                            finalDriveId = newDriveId;
                            finalDriveUrl = `https://drive.google.com/file/d/${newDriveId}/view`;
                            toast.success('CV stored in Temp folder', { id: 'drive-sync' });
                        } else {
                            toast.error('Drive upload failed - No file ID generated', { id: 'drive-sync' });
                        }
                    }
                } catch (e: any) {
                    console.error("Temp Drive upload failed", e);
                    toast.error('Drive integration error: ' + (e.message || 'Unknown error'), { id: 'drive-sync' });
                }
            } else if (driveToken && !currentRootId) {
                toast.warning('Google Drive root folder not configured in Settings.');
            }

            // Sanitize object to remove undefined and null values for Firestore
            const sanitizeObject = (obj: any) => {
                const newObj: any = {};
                Object.keys(obj).forEach(key => {
                    if (obj[key] !== undefined && obj[key] !== null) {
                        newObj[key] = obj[key];
                    }
                });
                return newObj;
            };

            // Detect existing candidate to avoid duplicating if the user uploads the same CV
            // This prevents "deleted" candidates from reappearing as duplicates
            const existingMatch = candidates.find(existing => {
                if (existing.email && c.email && existing.email.trim().toLowerCase() === c.email.trim().toLowerCase()) return true;
                if (existing.phone && c.phone && existing.phone.replace(/\D/g, '') === c.phone.replace(/\D/g, '')) return true;
                if (existing.candidateName && c.candidateName && existing.candidateName.toLowerCase().trim() === c.candidateName.toLowerCase().trim() && existing.discipline === c.discipline) return true;
                return false;
            });

            const docData = sanitizeObject({
                ...c,
                candidateName: c.candidateName || 'Candidate Result',
                yearsExp: typeof c.yearsExp === 'number' ? c.yearsExp : (Number(c.yearsExp) || 0),
                discipline: c.discipline || 'Uncategorized',
                driveFileId: finalDriveId || (existingMatch?.driveFileId || null),
                driveFileUrl: finalDriveUrl || (existingMatch?.driveFileUrl || null),
                ownerId: user!.uid,
                currentStatus: existingMatch?.currentStatus?.toLowerCase() === 'deleted' ? existingMatch.currentStatus : (c.currentStatus || 'New'),
                addedAt: existingMatch ? (existingMatch.addedAt || serverTimestamp()) : serverTimestamp(),
                updatedAt: serverTimestamp(),
                email: c.email || (existingMatch?.email || ''),
                phone: c.phone || (existingMatch?.phone || ''),
                rawText: c.rawText || (existingMatch?.rawText || '')
            });
            delete docData.id;

            try {
                const settingsSnap = await getDoc(doc(db, 'settings', user!.uid));
                console.log('----- SETTINGS DATA -----', settingsSnap.data());
            } catch(e) {
                console.error('FAILED TO FETCH SETTINGS', e);
            }

            console.log('--- SAVING EXPERT ---', docData);
            const path = 'candidates';
            let docRefId = '';
            
            if (existingMatch && existingMatch.id) {
                await updateDoc(doc(db, path, existingMatch.id), docData);
                docRefId = existingMatch.id;
            } else {
                const docRef = await addDoc(collection(db, path), docData);
                docRefId = docRef.id;
            }

            const sheetsDriveToken = accessToken || settings?.driveToken;
            if (settings?.autoBackupEnabled && sheetsDriveToken && settings?.googleSheetId) {
                const { syncToGoogleSheets } = await import('./services/sheetService');
                const { addToSyncQueue } = await import('./services/offlineSyncService');
                
                // 1. Sync to CV Extraction log tab
                const cvExtractionRow = [
                    docRefId,
                    c.fileName || '',
                    c.candidateName || 'N/A',
                    c.yearsExp || '0',
                    c.education || 'N/A',
                    c.workFields || 'N/A',
                    c.specializedField || 'N/A',
                    c.discipline || 'N/A',
                    c.aiScore || '',
                    new Date().toISOString()
                ];
                
                // 2. Sync to Discipline-specific tab
                const safeDiscipline = c.discipline ? c.discipline.replace(/[^a-zA-Z0-9_ -]/g, '_') : 'General';
                const disciplineRow = [
                    c.candidateName || 'N/A',
                    c.discipline || 'N/A',
                    c.yearsExp || '0',
                    c.workFields || 'N/A',
                    'New', // Default Status
                    '' // Actions
                ];
                
                if (!navigator.onLine) {
                    addToSyncQueue({ type: 'SHEET_SYNC', payload: { sheetId: settings.googleSheetId, rowData: cvExtractionRow, tabName: 'CV_Extraction' } });
                    addToSyncQueue({ type: 'SHEET_SYNC', payload: { sheetId: settings.googleSheetId, rowData: disciplineRow, tabName: `CVs_${safeDiscipline}` } });
                } else {
                    try {
                        await syncToGoogleSheets(settings.googleSheetId, cvExtractionRow, 'CV_Extraction');
                        await syncToGoogleSheets(settings.googleSheetId, disciplineRow, `CVs_${safeDiscipline}`);
                    } catch (e: any) {
                         if (!e.message?.includes('AUTH_REQUIRED')) {
                             console.error('Failed to sync sheets', e);
                         }
                         if (e.message?.includes('AUTH_REQUIRED') || e.message?.includes('NetworkError') || e.message?.includes('Failed to fetch')) {
                             addToSyncQueue({ type: 'SHEET_SYNC', payload: { sheetId: settings.googleSheetId, rowData: cvExtractionRow, tabName: 'CV_Extraction' } });
                             addToSyncQueue({ type: 'SHEET_SYNC', payload: { sheetId: settings.googleSheetId, rowData: disciplineRow, tabName: `CVs_${safeDiscipline}` } });
                             toast.info('Record queued for offline sync');
                         }
                    }
                }
            }

            // Data Protection: Internal Backup
            const backupPath = 'backups';
            try {
                await addDoc(collection(db, backupPath), {
                    originalId: docRefId,
                    candidateName: c.candidateName,
                    data: sanitizeObject(c),
                    timestamp: new Date().toISOString(),
                    type: 'INIT_BACKUP'
                });
            } catch (e) {
                handleFirestoreError(e, OperationType.WRITE, backupPath);
            }
            
            await logActivity(`Added expert: ${c.candidateName} (Auto-backed up)`, 'extract');
            toast.success('Expert Processed and Safety Backup Created');
            setActiveTab('catalog');
        } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, 'candidates');
        }
    };

    const updateCandidateStatus = async (id: string, status: CandidateStatus) => {
        if (!['Admin', 'Editor', 'Recruiter'].includes(profile?.role || '')) {
            toast.error('You do not have permission to update candidate status');
            return;
        }
        try {
            const cand = candidates.find(x => x.id === id);
            if (!cand) {
                console.warn(`[App] updateCandidateStatus: Candidate ${id} not found in state.`);
                return;
            }
            
            await updateDoc(doc(db, 'candidates', id), {
                currentStatus: status,
                status: status,
                updatedAt: serverTimestamp()
            });

            // Auto Move file in Drive if it exists
            if ((status === 'Hired' || status === 'Shortlisted') && accessToken && cand.driveFileId && settings?.driveRootFolderId) {
                try {
                    const { findOrCreateFolder, moveFile } = await import('./services/driveService');
                    const targetFolderId = await findOrCreateFolder(cand.discipline || 'Uncategorized', settings.driveRootFolderId);
                    if (targetFolderId) {
                        await moveFile(cand.driveFileId, targetFolderId);
                        toast.success(`Google Drive: CV moved to /${cand.discipline || 'Uncategorized'}`);
                    }
                } catch (e: any) {
                    console.error("Failed to move file in Drive:", e);
                    toast.error(`Drive Error: Could not move CV - ${e.message}`);
                }
            }

            // Auto Backup on status change to "Approved" (Hired/Shortlisted)
            if ((status === 'Hired' || status === 'Shortlisted') && settings?.autoBackupEnabled && accessToken && settings?.googleSheetId) {
                const { syncToGoogleSheets } = await import('./services/sheetService');
                const { addToSyncQueue } = await import('./services/offlineSyncService');
                    const rowData = [
                        id,
                        cand?.candidateName,
                        cand?.discipline,
                        cand?.specializedField,
                        cand?.yearsExp,
                        cand?.aiScore,
                        cand?.workFields,
                        status,
                        new Date().toISOString()
                    ];
                    
                    if (!navigator.onLine) {
                        addToSyncQueue({
                            type: 'SHEET_SYNC',
                            payload: { sheetId: settings.googleSheetId, rowData, tabName: 'Approved_Candidates' }
                        });
                        toast.info('Offline: Record queued for Google Sheets sync');
                    } else {
                        try {
                            await syncToGoogleSheets(
                                settings.googleSheetId,
                                rowData,
                                'Approved_Candidates'
                            );
                            toast.success('Record safely backed up to Google Sheets');
                        } catch (e: any) {
                            if (e.message?.includes('AUTH_REQUIRED') || e.message?.includes('NetworkError') || e.message?.includes('Failed to fetch')) {
                                addToSyncQueue({
                                    type: 'SHEET_SYNC',
                                    payload: { sheetId: settings.googleSheetId, rowData, tabName: 'Approved_Candidates' }
                                });
                                toast.info('Record queued for offline sync');
                            } else if (e.message.includes('Google Sheets API is disabled')) {
                                const gcpLink = e.message.match(/https:\/\/console\.developers\.google\.com\/apis\/api\/sheets\.googleapis\.com\/overview\?project=\d+/)?.[0];
                                toast.error('Google Sheets API is disabled', {
                                    description: 'Enable it in your Cloud Console to sync records.',
                                    action: gcpLink ? {
                                        label: 'Enable',
                                        onClick: () => window.open(gcpLink, '_blank')
                                    } : undefined
                                });
                            } else if (e.message.includes('Google Sheet not found')) {
                                toast.error('Auto-backup failed: Invalid Google Sheet ID', {
                                    description: 'Please go to Settings and check your Google Sheet Target ID.'
                                });
                            } else {
                                console.error("Sheets status update backup failed", e);
                            }
                        }
                    }
            }

            await logActivity(`Updated ${cand?.candidateName} to ${status}`, 'status');
            toast.success('Expert status synchronized');
        } catch (err: any) {
            const errorMsg = err.message || JSON.stringify(err);
            if (errorMsg.includes('No document to update')) {
                console.warn(`[App] Update failed: Document ${id} no longer exists.`);
                try { await deleteDoc(doc(db, 'candidates', id)); } catch(e){}
                toast.success('Cleared ghost record from view');
                setCandidates(prev => prev.filter(c => c.id !== id)); // Remove ghost record
            } else {
                handleFirestoreError(err, OperationType.UPDATE, `candidates/${id}`);
            }
        }
    };

    const updateCandidateDiscipline = async (id: string, discipline: string) => {
        if (!['Admin', 'Editor', 'Recruiter'].includes(profile?.role || '')) {
            toast.error('You do not have permission to update candidate discipline');
            return;
        }
        try {
            const cand = candidates.find(x => x.id === id);
            if (!cand) return;
            
            await updateDoc(doc(db, 'candidates', id), {
                discipline: discipline,
                updatedAt: serverTimestamp()
            });
            
            // If the candidate is Hired/Shortlisted, their file in Google Drive should be moved to the new discipline folder
            if ((cand?.currentStatus === 'Hired' || cand?.currentStatus === 'Shortlisted' || (cand as any)?.status === 'Hired' || (cand as any)?.status === 'Shortlisted') && accessToken && cand.driveFileId && settings?.driveRootFolderId) {
                try {
                    const { findOrCreateFolder, moveFile } = await import('./services/driveService');
                    const targetFolderId = await findOrCreateFolder(discipline || 'Uncategorized', settings.driveRootFolderId);
                    if (targetFolderId) {
                        await moveFile(cand.driveFileId, targetFolderId);
                        toast.success(`Google Drive: CV moved to /${discipline || 'Uncategorized'}`);
                    }
                } catch (e: any) {
                    console.error("Failed to move file in Drive when discipline changed:", e);
                }
            }

            await logActivity(`Updated discipline to [${discipline}] for: ${cand?.candidateName}`, 'status');
            toast.success('Discipline updated');
        } catch (err: any) {
            handleFirestoreError(err, OperationType.UPDATE, `candidates/${id}`);
        }
    };

    const deleteCandidate = async (id: string) => {
        if (!['Admin', 'Editor', 'Recruiter'].includes(profile?.role || '')) {
            toast.error('You do not have permission to delete candidates');
            return;
        }
        try {
            const cand = candidates.find(x => x.id === id);
            if (!cand) {
                console.warn(`[App] deleteCandidate: Candidate ${id} not found in state.`);
                return;
            }
            
            if (cand?.currentStatus?.toLowerCase() === 'deleted' || (cand as any)?.status?.toLowerCase() === 'deleted') {
                // Permanent delete
                await deleteDoc(doc(db, 'candidates', id));
                await logActivity(`Permanently deleted expert record: ${cand?.candidateName}`, 'delete');
                toast.success('Expert record permanently deleted');
            } else {
                // Soft delete by updating status
                await updateDoc(doc(db, 'candidates', id), {
                    currentStatus: 'deleted',
                    status: 'deleted',
                    deletedAt: serverTimestamp(),
                    deletedBy: user!.uid
                });
                await logActivity(`Moved expert record to Trash: ${cand?.candidateName}`, 'delete');
                toast.success('Expert moved to Trash');
            }
        } catch (err: any) {
            const errorMsg = err.message || JSON.stringify(err);
            if (errorMsg.includes('No document to update')) {
                console.warn(`[App] Delete failed: Document ${id} no longer exists.`);
                try { await deleteDoc(doc(db, 'candidates', id)); } catch(e){}
                toast.success('Cleared ghost record from view');
                setCandidates(prev => prev.filter(c => c.id !== id)); // Remove ghost record
            } else {
                handleFirestoreError(err, OperationType.UPDATE, `candidates/${id}`);
            }
        }
    };

    const emptyTrash = async () => {
        if (!['Admin', 'Editor'].includes(profile?.role || '')) {
            toast.error('You do not have permission to empty trash');
            return;
        }

        const trashCandidates = candidates.filter(c => {
            const cs = (c.currentStatus || (c as any).status || '').toLowerCase();
            return cs === 'deleted';
        });

        if (trashCandidates.length === 0) {
            toast.info('Trash is already empty');
            return;
        }

        let deletedCount = 0;
        let failedCount = 0;

        for (const cand of trashCandidates) {
            try {
                await deleteDoc(doc(db, 'candidates', cand.id));
                deletedCount++;
            } catch (err) {
                console.error(`Failed to delete candidate ${cand.id}:`, err);
                failedCount++;
            }
        }

        if (deletedCount > 0) {
            toast.success(`Permanently deleted ${deletedCount} expert records`);
            await logActivity(`Emptied trash: permanently deleted ${deletedCount} records`);
        }
        if (failedCount > 0) {
            toast.error(`Failed to delete ${failedCount} records`);
        }
    };

    const activeCandidates = candidates.filter(c => {
        const cs = c.currentStatus?.toLowerCase() || (c as any).status?.toLowerCase();
        return cs !== 'deleted';
    });

    if (loading) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest tabular-nums">Decrypting Core Database...</p>
            </div>
        );
    }

  const renderView = () => {
    return (
      <div className="h-full relative">
        <div className={activeTab === 'dashboard' ? 'block h-full' : 'hidden'}><Dashboard candidates={activeCandidates} activities={activities} /></div>
        <div className={activeTab === 'folders' ? 'block h-full' : 'hidden'}><FolderManagement candidates={activeCandidates} /></div>
        <div className={activeTab === 'extract' ? 'block h-full' : 'hidden'}><CVExtraction onExpertAdded={addCandidate} /></div>
        <div className={activeTab === 'templates' ? 'block h-full' : 'hidden'}><CompanyTemplates candidates={activeCandidates} /></div>
        <div className={activeTab === 'ai' ? 'block h-full' : 'hidden'}><AITools candidates={activeCandidates} /></div>
        <div className={activeTab === 'search' ? 'block h-full' : 'hidden'}><SmartSearch candidates={activeCandidates} onStatusChange={updateCandidateStatus} onDelete={deleteCandidate} /></div>
        <div className={activeTab === 'personnel' ? 'block h-full' : 'hidden'}><PersonnelDirectory candidates={candidates} onStatusChange={updateCandidateStatus} onDisciplineChange={updateCandidateDiscipline} onDelete={deleteCandidate} onEmptyTrash={emptyTrash} /></div>
        <div className={activeTab === 'reports' ? 'block h-full' : 'hidden'}><ReportsView candidates={activeCandidates} /></div>
        <div className={activeTab === 'settings' ? 'block h-full' : 'hidden'}><Settings /></div>
      </div>
    );
  };

  const menuSections = [
    {
      title: 'Main',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'folders', label: 'Folder Management', icon: FolderTree },
        { id: 'extract', label: 'CV Extraction', icon: FileUp },
      ]
    },
    {
      title: 'Tools',
      items: [
        { id: 'templates', label: 'Company Templates', icon: Building2 },
        { id: 'ai', label: 'AI Tools', icon: Bot },
        { id: 'search', label: 'Smart Search', icon: Search },
      ]
    },
    {
      title: 'People',
      items: [
        { id: 'personnel', label: 'Personnel Directory', icon: Users },
        { id: 'reports', label: 'Reports', icon: BarChart3 },
      ]
    },
    {
      title: 'System',
      items: [
        { id: 'settings', label: 'Settings', icon: SettingsIcon },
        { 
          id: 'drive_link', 
          label: 'Shared CV Drive', 
          icon: ExternalLink, 
          action: () => {
             if (settings?.driveRootFolderId) {
                 window.open(`https://drive.google.com/drive/folders/${settings.driveRootFolderId}`, '_blank');
             } else {
                 toast.error('Shared Drive folder is not configured by the admin yet.');
             }
          }
        },
      ]
    }
  ];

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className={`${sidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1c] text-white flex flex-col shrink-0 transition-all duration-300 ease-in-out relative group/sidebar border-r border-white/5`}>
        <div className={`p-8 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl ring-1 ring-white/20 shadow-xl shadow-blue-900/20">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight leading-none text-white">Expertise</span>
                <span className="text-[9px] uppercase font-black text-blue-400 tracking-[0.2em] mt-1.5 drop-shadow-sm">Manager V2</span>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
             <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl ring-1 ring-white/20 shadow-xl shadow-blue-900/20">
                <Users className="w-6 h-6 text-white" />
             </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-4 space-y-8 overflow-y-auto custom-scrollbar scrollbar-hide">
          {menuSections.map(section => (
            <div key={section.title} className="space-y-2">
              {!sidebarCollapsed && (
                <p className="px-5 text-[10px] font-black uppercase text-slate-500 tracking-[0.3em] mb-4">
                  {section.title}
                </p>
              )}
              {section.items.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.action) {
                        item.action();
                      } else {
                        setActiveTab(item.id);
                      }
                    }}
                    className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group relative ${
                      isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/20' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                    title={sidebarCollapsed ? item.label : ''}
                  >
                    <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                    
                    {!sidebarCollapsed && (
                      <span className={`text-[14px] font-bold tracking-wide ${isActive ? 'text-white drop-shadow-sm' : 'text-slate-400 group-hover:text-white'}`}>
                        {item.label}
                      </span>
                    )}
                    
                    {!sidebarCollapsed && item.id === 'personnel' && candidates.length > 0 && (
                      <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-black transition-colors duration-300 ${isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'}`}>
                        {candidates.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Toggle Button */}
        <button 
          onClick={toggleSidebar}
          className="absolute -right-3.5 top-24 w-7 h-7 bg-slate-900 border border-slate-700 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all z-[60] text-slate-400 hover:text-white hover:border-slate-500"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* User Card */}
        <div className="p-4 mt-auto">
          <div className={`p-4 bg-[#111827] border border-slate-800 rounded-[2rem] space-y-4 transition-all hover:border-slate-700 ${sidebarCollapsed ? 'items-center flex flex-col px-2' : ''}`}>
             <div className={`flex items-center gap-4 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-2xl bg-slate-800 overflow-hidden ring-2 ring-slate-700 shadow-inner">
                        {user?.photoURL ? (
                          <img src={user.photoURL} alt="User" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800 text-white font-bold">
                            {user?.displayName?.charAt(0) || 'U'}
                          </div>
                        )}
                    </div>
                    {/* Sync Dot */}
                    <div className="absolute -bottom-1 -right-1 ring-2 ring-[#111827] rounded-full bg-[#111827]">
                      <SyncDot />
                    </div>
                </div>
                
                {!sidebarCollapsed && (
                  <div className="flex-1 overflow-hidden">
                      <p className="text-[10px] font-black text-slate-500 truncate uppercase tracking-widest">{user?.email}</p>
                      <p className="text-sm font-bold truncate text-slate-200 tracking-tight">{user?.displayName || 'User profile'}</p>
                  </div>
                )}
             </div>
             
             {!sidebarCollapsed && (
                 <Button 
                    variant="ghost" 
                    className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800/50 p-0 h-auto gap-3 group/signout px-2 py-1.5 rounded-xl transition-all" 
                    onClick={logout}
                 >
                   <div className="p-1.5 bg-slate-800 rounded-lg group-hover/signout:bg-red-500/10 transition-colors">
                    <LogOut className="w-4 h-4 text-slate-400 group-hover/signout:text-red-400 transition-colors" />
                   </div>
                   <span className="text-xs font-bold uppercase tracking-widest text-slate-500 group-hover/signout:text-white transition-colors">Sign Out</span>
                 </Button>
             )}
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 overflow-y-auto p-1/2 md:p-8">
        {/* Fullscreen Toggle Button */}
        <div className="fixed top-4 right-4 z-[100]">
            <Button
                variant="outline"
                size="icon"
                onClick={toggleFullscreen}
                className="bg-white/90 backdrop-blur-sm border-slate-200 shadow-md hover:shadow-lg transition-all rounded-full w-10 h-10 flex items-center justify-center group"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
                {isFullscreen ? (
                    <Minimize className="w-5 h-5 text-slate-600 group-hover:scale-110 transition-transform" />
                ) : (
                    <Maximize className="w-5 h-5 text-slate-600 group-hover:scale-110 transition-transform" />
                )}
            </Button>
        </div>

        <div className="max-w-[1400px] mx-auto space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                        {menuSections.flatMap(s => s.items).find(i => i.id === activeTab)?.label}
                    </h1>
                    <p className="text-sm font-medium text-slate-400 mt-1 uppercase tracking-widest">
                        Oil & Gas Recruitment Intelligence
                    </p>
                </div>
                <SessionTracker />
            </header>

            <div className="pb-20">
                {renderView()}
            </div>
        </div>
      </main>
      <Toaster position="bottom-right" richColors />
      <ChatBox candidates={activeCandidates} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AuthWrapper />
    </AuthProvider>
  );
}

const SyncDot = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    return (
        <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-slate-900 rounded-full ${isOnline ? "bg-emerald-500" : "bg-slate-400"}`} title={isOnline ? "Online & Syncing" : "Offline Mode"} />
    );
};

const AuthWrapper = () => {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Initializing System...</p>
                </div>
            </div>
        );
    }
    return user ? <MainContent /> : <LoginPage />;
}
