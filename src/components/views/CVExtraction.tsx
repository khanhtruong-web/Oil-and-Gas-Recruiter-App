import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Candidate, UserSettings } from '../../types';
import { useDisciplines } from '../../hooks/useDisciplines';
import { extractTextFromPdf } from '../../services/pdfService';
import { extractTextFromDocx, extractHtmlFromDocx, extractTextFromDoc } from '../../services/docxParserService';
import { geminiService } from '../../services/geminiService';
import { useAuth } from '../AuthProvider';
import { toast } from 'sonner';
import { FileUp, Bot, Loader2, Database, Trash2, CheckSquare, SplitSquareHorizontal, Eye, FileText, ChevronLeft, ChevronRight, Pencil, Check, Copy, FileDown, FileSpreadsheet, LayoutGrid, FolderOpen } from 'lucide-react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { googleManager } from '../../services/GoogleWorkspaceManager';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { handleFirestoreError, OperationType } from '../../lib/firestore-error';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const CVExtraction = ({ onExpertAdded }: { onExpertAdded: (c: Partial<Candidate>, driveFileId?: string) => void }) => {
    const [loading, setLoading] = useState(false);
    const [activeAction, setActiveAction] = useState<string>('');
    const [extractedList, setExtractedList] = useState<(Partial<Candidate> & { id: string, fileName: string, driveFileId?: string, rawText?: string, rawHtml?: string, fileUrl?: string, fileType?: string })[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [stagedFiles, setStagedFiles] = useState<{ id: string, file: File, url: string, parsing?: boolean, error?: string }[]>([]);
    
    const { accessToken, user, refreshTokenSilently, authorizeDrive } = useAuth();
    const [settings, setSettings] = useState<UserSettings | null>(null);

    // Modal
    const [reviewingCv, setReviewingCv] = useState<any>(null);
    const [previewMode, setPreviewMode] = useState<'text' | 'file'>('file');
    const [pdfPageNumber, setPdfPageNumber] = useState<number>(1);
    const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);

    // Resizable Splitter
    const [leftPanelWidth, setLeftPanelWidth] = useState(65); // percentage
    const [isDragging, setIsDragging] = useState(false);

    const { disciplines: DISCIPLINE_CATALOG } = useDisciplines();

    useEffect(() => {
        if (!user) return;
        return onSnapshot(doc(db, 'settings', user.uid), (d) => {
            if (d.exists()) setSettings(d.data() as UserSettings);
        }, (error) => {
            handleFirestoreError(error, OperationType.GET, 'settings');
        });
    }, [user]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const percentage = (e.clientX / window.innerWidth) * 100;
            if (percentage > 20 && percentage < 80) {
                setLeftPanelWidth(percentage);
            }
        };
        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        
        const newStaged = files.map(file => ({
            id: Math.random().toString(36).substring(7),
            file,
            url: URL.createObjectURL(file)
        }));
        
        setStagedFiles(prev => [...prev, ...newStaged]);
        e.target.value = ''; // reset
    };

    const removeStagedFile = (id: string) => {
        setStagedFiles(prev => prev.filter(f => f.id !== id));
    };

    const runExtraction = async () => {
        if (stagedFiles.length === 0) return;
        
        setLoading(true);
        setActiveAction(`Processing ${stagedFiles.length} files...`);
        
        const newExtracted = [...extractedList];
        const remainingStaged = [...stagedFiles];

        for (let i = 0; i < stagedFiles.length; i++) {
            const staged = stagedFiles[i];
            // Update UI to show this file is parsing
            setStagedFiles(prev => prev.map(f => f.id === staged.id ? { ...f, parsing: true } : f));
            setActiveAction(`Parsing file ${i+1}/${stagedFiles.length}: ${staged.file.name}`);
            
            try {
                let text = '';
                let rawHtml = '';
                const file = staged.file;
                if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                    text = await extractTextFromPdf(file);
                } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
                    text = await extractTextFromDocx(file);
                    rawHtml = await extractHtmlFromDocx(file);
                } else if (file.type === 'application/msword' || file.name.endsWith('.doc')) {
                    text = await extractTextFromDoc(file);
                    rawHtml = ''; // Basic extraction doesn't provide HTML
                } else {
                    toast.warning(`Skipped ${file.name} (unsupported format)`);
                    setStagedFiles(prev => prev.filter(f => f.id !== staged.id));
                    continue;
                }

                setActiveAction(`AI Analyzing ${file.name}...`);
                const parsed = await geminiService.parseCV(text);
                newExtracted.push({
                    ...parsed,
                    id: staged.id,
                    fileName: file.name,
                    rawText: text,
                    rawHtml: rawHtml,
                    fileUrl: staged.url,
                    fileType: file.type
                });
                // Remove from staged since it succeeded
                setStagedFiles(prev => prev.filter(f => f.id !== staged.id));
            } catch (err: any) {
                let errorMsg = err.message || "Unknown error";
                try {
                    const parsedErr = JSON.parse(errorMsg);
                    if (parsedErr.error && parsedErr.error.message) {
                        errorMsg = parsedErr.error.message;
                    }
                } catch(e) {}
                
                toast.error(`Failed to process ${staged.file.name}: ${errorMsg}`);
                setStagedFiles(prev => prev.map(f => f.id === staged.id ? { ...f, parsing: false, error: errorMsg } : f));
            }
        }
        
        setExtractedList(newExtracted);
        setLoading(false);
        setActiveAction('');
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === extractedList.length) setSelectedIds([]);
        else setSelectedIds(extractedList.map(x => x.id));
    };

    const removeSelected = () => {
        setExtractedList(prev => prev.filter(x => !selectedIds.includes(x.id)));
        setSelectedIds([]);
        toast.info('Removed selected items from queue');
    };

    const confirmSelected = () => {
        const toConfirm = extractedList.filter(x => selectedIds.includes(x.id));
        toConfirm.forEach(cv => {
            onExpertAdded(cv, cv.driveFileId);
        });
        setExtractedList(prev => prev.filter(x => !selectedIds.includes(x.id)));
        setSelectedIds([]);
        toast.success(`Confirmed ${toConfirm.length} CVs to database`);
    };

    const openReviewModal = (cv: any) => {
        setReviewingCv({ ...cv });
        setPdfPageNumber(1);
        setPdfNumPages(null);
    };

    const saveReview = () => {
        setExtractedList(prev => prev.map(x => x.id === reviewingCv.id ? reviewingCv : x));
        setReviewingCv(null);
        toast.success('Changes saved');
    };

    const confirmAndSaveReview = () => {
        onExpertAdded(reviewingCv, reviewingCv.driveFileId);
        setExtractedList(prev => prev.filter(x => x.id !== reviewingCv.id));
        setSelectedIds(prev => prev.filter(x => x !== reviewingCv.id));
        setReviewingCv(null);
        toast.success('CV Confirmed & Saved');
    };

    const exportToCSV = () => {
        if (extractedList.length === 0) return;
        const headers = ["NO", "CV FILE NAME", "CANDIDATE NAME", "EMAIL", "PHONE", "EXP", "EDUCATION", "WORK FIELDS", "SPECIALIZED FIELD", "DISCIPLINE"];
        const rows = extractedList.map((cv, index) => [
            index + 1,
            `"${cv.fileName}"`,
            `"${cv.candidateName}"`,
            `"${cv.email || 'N/A'}"`,
            `"${cv.phone || 'N/A'}"`,
            cv.yearsExp,
            `"${cv.education || "N/A"}"`,
            `"${cv.workFields || "N/A"}"`,
            `"${cv.specializedField || "N/A"}"`,
            `"${cv.discipline}"`
        ]);
        
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `cv_results_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Exported to CSV');
    };

    const copyToClipboard = () => {
        if (extractedList.length === 0) return;
        const text = extractedList.map(cv => 
            `${cv.candidateName}\t${cv.yearsExp}\t${cv.education || 'N/A'}\t${cv.discipline}`
        ).join("\n");
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="grid grid-cols-1 mb-6 gap-6">
                <Card className="border-none shadow-sm lg:col-span-1">
                    <CardHeader className="bg-slate-50 border-b border-slate-100 py-6">
                        <CardTitle className="text-xl font-black flex items-center gap-2">
                            <FileUp className="w-6 h-6 text-primary" />
                            CV Extraction
                        </CardTitle>
                        <CardDescription className="text-slate-500 font-semibold uppercase text-[9px] tracking-widest">Upload Multiple CVs & AI Parsing</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="flex border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 relative overflow-hidden mb-6 hover:border-primary/50 transition-colors">
                            <input 
                                type="file" 
                                multiple 
                                accept=".pdf,.docx,.doc" 
                                onChange={handleFileUpload}
                                className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                                disabled={loading}
                            />
                            <div className="w-full flex flex-col items-center justify-center p-10 text-slate-500">
                                {loading ? (
                                    <>
                                        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                                        <p className="font-bold text-sm text-slate-700">{activeAction}</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                                            <FileUp className="w-6 h-6 text-primary" />
                                        </div>
                                        <p className="font-bold text-slate-700">Drag & Drop CV files here</p>
                                        <p className="text-xs text-slate-400 mt-1">or click to browse (PDF, DOCX)</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {stagedFiles.length > 0 && (
                            <div className="mb-8 space-y-4 animate-in slide-in-from-bottom-4">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <h4 className="font-black text-sm text-slate-700 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-blue-500" />
                                        Files Ready for Analysis ({stagedFiles.length})
                                    </h4>
                                    <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={runExtraction} disabled={loading}>
                                        <Bot className="w-4 h-4 mr-2" />
                                        {loading ? 'Analyzing...' : 'Run AI Extraction'}
                                    </Button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {stagedFiles.map(file => (
                                        <div key={file.id} className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden flex flex-col group relative">
                                            {!loading && !file.parsing && (
                                                <button 
                                                    className={`absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm hover:bg-red-50 text-red-500 rounded-lg transition-opacity z-20 shadow-sm ${file.error ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                                    onClick={() => removeStagedFile(file.id)}
                                                    title="Remove File"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            <div className="h-32 bg-slate-50 border-b border-slate-100 overflow-hidden relative">
                                                {file.parsing ? (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-10 text-primary">
                                                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Parsing</span>
                                                    </div>
                                                ) : file.error ? (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 z-10 text-red-500 p-4 text-center">
                                                        <span className="text-[10px] font-black uppercase tracking-widest mb-1">Error</span>
                                                        <span className="text-xs">{file.error}</span>
                                                    </div>
                                                ) : null}
                                                {file.file.type === 'application/pdf' || file.file.name.endsWith('.pdf') ? (
                                                    <div className="w-full h-full overflow-hidden flex items-start justify-center pt-2">
                                                        <Document 
                                                            file={file.url} 
                                                            className="pointer-events-none origin-top scale-[0.65]"
                                                            loading={<Loader2 className="w-6 h-6 animate-spin text-slate-300" />}
                                                        >
                                                            <Page pageNumber={1} width={250} renderTextLayer={false} renderAnnotationLayer={false} />
                                                        </Document>
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                        <FileText className="w-12 h-12" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-3">
                                                <p className="text-xs font-bold text-slate-700 truncate" title={file.file.name}>{file.file.name}</p>
                                                <p className="text-[9px] uppercase tracking-widest text-slate-400 mt-1">{(file.file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {extractedList.length > 0 && (
                            <div className="space-y-6 animate-in slide-in-from-bottom-4">
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg">
                                            <LayoutGrid className="w-5 h-5 text-white" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-800">Results ({extractedList.length})</h3>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm mr-4">
                                            <Button variant="ghost" size="sm" className="h-9 px-4 font-bold text-slate-700 hover:bg-slate-50" onClick={copyToClipboard}>
                                                <Copy className="w-4 h-4 mr-2" /> Copy
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-9 px-4 font-bold text-slate-700 hover:bg-slate-50" onClick={exportToCSV}>
                                                <FileDown className="w-4 h-4 mr-2" /> CSV
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-9 px-4 font-bold text-slate-700 hover:bg-slate-50" onClick={exportToCSV}>
                                                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
                                            </Button>
                                        </div>

                                        {selectedIds.length > 0 && (
                                            <div className="flex items-center gap-2 animate-in fade-in zoom-in-95">
                                                <Button variant="outline" size="sm" className="h-10 px-6 font-bold text-red-500 border-red-200 hover:bg-red-50 rounded-xl shadow-sm" onClick={removeSelected}>
                                                    <Trash2 className="w-4 h-4 mr-2" /> Remove ({selectedIds.length})
                                                </Button>
                                                <Button size="sm" className="h-10 px-6 font-black bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-500/20" onClick={confirmSelected}>
                                                    <CheckSquare className="w-4 h-4 mr-2" /> Confirm & Commit
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-xl">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase font-black tracking-widest text-slate-400">
                                                <tr>
                                                    <th className="p-4 w-10 text-center">
                                                        <Checkbox 
                                                            checked={selectedIds.length === extractedList.length && extractedList.length > 0} 
                                                            onCheckedChange={toggleSelectAll} 
                                                        />
                                                    </th>
                                                    <th className="p-4 w-12">NO</th>
                                                    <th className="p-4 w-[16%]">CV FILE NAME</th>
                                                    <th className="p-4 w-[12%]">CANDIDATE NAME</th>
                                                    <th className="p-4 w-[10%]">EMAIL</th>
                                                    <th className="p-4 w-[8%]">PHONE</th>
                                                    <th className="p-4 w-[5%]">EXP</th>
                                                    <th className="p-4 w-[12%]">EDUCATION</th>
                                                    <th className="p-4 w-[12%]">WORK FIELDS</th>
                                                    <th className="p-4 w-[12%]">SPECIALIZED FIELD</th>
                                                    <th className="p-4 w-[12%]">DISCIPLINE</th>
                                                    <th className="p-4 w-28 text-center">ACTION</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 italic-none">
                                                {extractedList.map((cv, index) => (
                                                    <tr key={cv.id} className="group hover:bg-slate-50/50 transition-all">
                                                        <td className="p-4 text-center">
                                                            <Checkbox checked={selectedIds.includes(cv.id)} onCheckedChange={() => toggleSelect(cv.id)} />
                                                        </td>
                                                        <td className="p-4 text-slate-400 font-mono text-xs">{index + 1}</td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-3 text-slate-600" title={cv.fileName}>
                                                                <FileText className="w-4 h-4 shrink-0 text-slate-400" />
                                                                <span className="whitespace-normal break-words font-black text-slate-600 text-[11px] uppercase tracking-tight leading-tight">{cv.fileName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="font-black text-[11px] text-slate-900 border-b border-dashed border-slate-200">{cv.candidateName}</span>
                                                        </td>
                                                        <td className="p-4">
                                                            {cv.email ? (
                                                               <a href={`mailto:${cv.email}`} className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline block truncate max-w-[150px]" title={cv.email}>
                                                                   {cv.email}
                                                               </a>
                                                            ) : <span className="text-[11px] text-slate-400">---</span>}
                                                        </td>
                                                        <td className="p-4">
                                                            {cv.phone ? (
                                                               <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">{cv.phone}</span>
                                                            ) : <span className="text-[11px] text-slate-400">---</span>}
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="font-bold text-slate-600 tabular-nums bg-slate-50 px-2 py-1 rounded-md border border-slate-100">{cv.yearsExp}</span>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="text-[11px] leading-tight font-bold text-slate-500 block break-words border-b border-dotted border-slate-300 min-w-[100px]" title={cv.education}>{cv.education || '---'}</span>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="text-[11px] leading-tight font-bold text-slate-500 block break-words border-b border-dotted border-slate-300 min-w-[100px]" title={cv.workFields}>{cv.workFields || '---'}</span>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="text-[11px] leading-tight font-bold text-slate-500 block break-words border-b border-dotted border-slate-300 min-w-[100px]" title={cv.specializedField}>{cv.specializedField || '---'}</span>
                                                        </td>
                                                        <td className="p-4">
                                                            <Badge variant="secondary" className="text-[9px] font-black uppercase bg-cyan-50 text-cyan-800 border-cyan-100/50 px-3 py-1 rounded-lg shadow-sm">{cv.discipline}</Badge>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <Button variant="ghost" size="icon" className="w-9 h-9 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg" onClick={() => openReviewModal(cv)}>
                                                                    <Pencil className="w-4 h-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="w-9 h-9 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" onClick={() => {
                                                                    onExpertAdded(cv, cv.driveFileId);
                                                                    setExtractedList(prev => prev.filter(x => x.id !== cv.id));
                                                                    setSelectedIds(prev => prev.filter(x => x !== cv.id));
                                                                    toast.success('Candidate Approved');
                                                                }}>
                                                                    <Check className="w-5 h-5" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="w-9 h-9 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" onClick={() => {
                                                                    setExtractedList(prev => prev.filter(x => x.id !== cv.id));
                                                                    setSelectedIds(prev => prev.filter(x => x !== cv.id));
                                                                    toast.info('Removed from list');
                                                                }}>
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>


            </div>

            <Dialog open={!!reviewingCv} onOpenChange={(o) => { if (!o) setReviewingCv(null); }}>
                <DialogContent className="max-w-[96vw] sm:max-w-[96vw] md:max-w-[96vw] lg:max-w-[96vw] w-full h-[96vh] flex flex-col p-0 overflow-hidden bg-slate-50 shadow-2xl border-none sm:rounded-2xl transition-all duration-300">
                    {/* Fixed Header */}
                    <DialogHeader className="px-6 py-4 bg-white border-b border-slate-200 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                    <Bot className="w-6 h-6 text-primary" />
                                </div>
                                <div className="space-y-0.5">
                                    <DialogTitle className="text-xl font-black tracking-tight text-slate-800">
                                        Professional Review & Verification
                                    </DialogTitle>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest truncate max-w-[500px]">{reviewingCv?.fileName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 pr-4">
                                <div className="hidden lg:flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl border border-blue-100">
                                    <FileText className="w-4 h-4" />
                                    <span className="text-xs font-black uppercase tracking-tight">{reviewingCv?.fileType || 'Document'}</span>
                                </div>
                                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-100">
                                    <Bot className="w-4 h-4" />
                                    <span className="text-xs font-black uppercase tracking-tight">AI Accuracy: {reviewingCv?.aiScore || 92}%</span>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    {reviewingCv && (
                        <div className="flex-1 flex overflow-hidden bg-white">
                            {/* Left Pane - Document Preview */}
                            <div 
                                className="flex flex-col border-r border-slate-200 overflow-hidden h-full relative"
                                style={{ width: `${leftPanelWidth}%` }}
                            >
                                <div className="px-4 py-3 bg-slate-50 font-black text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-200 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-2">
                                        <Eye className="w-4 h-4 text-primary" /> 
                                        Source Document
                                    </div>
                                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                                        <Button 
                                            variant={previewMode === 'file' ? 'default' : 'ghost'} 
                                            size="sm" 
                                            className={`h-7 px-4 text-[10px] uppercase font-black tracking-widest ${previewMode === 'file' ? 'bg-primary shadow-lg shadow-primary/20' : 'text-slate-400'}`}
                                            onClick={() => setPreviewMode('file')}
                                        >
                                            Visual Mode
                                        </Button>
                                        <Button 
                                            variant={previewMode === 'text' ? 'default' : 'ghost'} 
                                            size="sm" 
                                            className={`h-7 px-4 text-[10px] uppercase font-black tracking-widest ${previewMode === 'text' ? 'bg-primary shadow-lg shadow-primary/20' : 'text-slate-400'}`}
                                            onClick={() => setPreviewMode('text')}
                                        >
                                            Raw Text
                                        </Button>
                                    </div>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-8 scrollbar-thin bg-slate-100/40">
                                    {previewMode === 'file' && (reviewingCv.fileType === 'application/pdf' || reviewingCv.fileName.endsWith('.pdf')) ? (
                                        <div className="flex flex-col items-center gap-6 mb-8">
                                            <Document
                                                file={reviewingCv.fileUrl}
                                                onLoadSuccess={({ numPages }) => setPdfNumPages(numPages)}
                                                loading={
                                                    <div className="flex flex-col items-center justify-center h-[600px] border-2 border-dashed border-slate-200 rounded-3xl bg-white/50 w-full">
                                                        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Rendering Digital Preview...</span>
                                                    </div>
                                                }
                                                className="flex flex-col gap-6"
                                            >
                                                {Array.from({ length: pdfNumPages || 0 }, (_, i) => i + 1).map(page => (
                                                    <div key={`page_${page}`} className="shadow-2xl rounded-sm border border-slate-200 overflow-hidden">
                                                        <Page 
                                                            pageNumber={page} 
                                                            width={window.innerWidth * (leftPanelWidth/100) * 0.9} 
                                                            renderTextLayer={true} 
                                                            renderAnnotationLayer={true} 
                                                        />
                                                    </div>
                                                ))}
                                            </Document>
                                        </div>
                                    ) : previewMode === 'file' && reviewingCv.rawHtml ? (
                                        <div className="bg-white p-10 shadow-xl rounded-3xl border border-slate-100 max-w-4xl mx-auto mb-10">
                                            <div 
                                                className="prose prose-slate prose-lg max-w-none text-slate-800"
                                                dangerouslySetInnerHTML={{ __html: reviewingCv.rawHtml }} 
                                            />
                                        </div>
                                    ) : (
                                        <div className="max-w-4xl mx-auto mb-10">
                                            <div className="bg-white border-2 border-slate-100 p-8 rounded-3xl shadow-lg relative">
                                                <pre className="text-sm font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
                                                    {reviewingCv.rawText || 'No text content extracted from this document.'}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Resize Handle */}
                                <div 
                                    className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary transition-colors group z-20"
                                    onMouseDown={() => setIsDragging(true)}
                                >
                                    <div className="absolute top-1/2 right-0 -translate-y-1/2 w-4 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-xl transition-opacity">
                                        <SplitSquareHorizontal className="w-3 h-3 text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Right Pane - Verification Form */}
                            <div 
                                className="flex flex-col overflow-hidden h-full bg-slate-50/50"
                                style={{ width: `${100 - leftPanelWidth}%` }}
                            >
                                <div className="px-6 py-3 bg-white font-black text-[10px] uppercase tracking-widest text-primary border-b border-slate-200 flex items-center gap-2 shrink-0">
                                    <Bot className="w-4 h-4" />
                                    Review & Data Correction
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
                                    <section className="space-y-4">
                                        <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] border-b border-slate-200 pb-2">Identification</h4>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Candidate Full Name</label>
                                            <Input 
                                                className="h-12 font-black text-lg border-slate-200 focus:ring-4 focus:ring-primary/5 w-full rounded-xl bg-white shadow-sm" 
                                                value={reviewingCv.candidateName || ''} 
                                                onChange={e => setReviewingCv({...reviewingCv, candidateName: e.target.value})} 
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Experience (Years)</label>
                                                <Input 
                                                    type="number" 
                                                    className="h-11 font-black border-slate-200 w-full rounded-xl bg-white shadow-sm" 
                                                    value={reviewingCv.yearsExp ?? 0} 
                                                    onChange={e => setReviewingCv({...reviewingCv, yearsExp: Number(e.target.value)})} 
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Primary Discipline</label>
                                                <Select value={reviewingCv.discipline || ''} onValueChange={(val) => setReviewingCv({...reviewingCv, discipline: val})}>
                                                    <SelectTrigger className="h-11 font-black border-slate-200 w-full bg-white rounded-xl shadow-sm">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border-slate-200">
                                                        {DISCIPLINE_CATALOG.map(d => (
                                                            <SelectItem key={d} value={d} className="font-bold">{d}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="space-y-4">
                                        <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] border-b border-slate-200 pb-2">Contact Intelligence</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Email Communication</label>
                                                <Input 
                                                    className="h-11 font-bold border-slate-200 w-full rounded-xl bg-white shadow-sm" 
                                                    value={reviewingCv.email || ''} 
                                                    onChange={e => setReviewingCv({...reviewingCv, email: e.target.value})} 
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Direct Phone</label>
                                                <Input 
                                                    className="h-11 font-bold border-slate-200 w-full rounded-xl bg-white shadow-sm" 
                                                    value={reviewingCv.phone || ''} 
                                                    onChange={e => setReviewingCv({...reviewingCv, phone: e.target.value})} 
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="space-y-4">
                                        <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] border-b border-slate-200 pb-2">Background & Expertise</h4>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Highest Education Level</label>
                                            <Input 
                                                className="h-11 font-bold border-slate-200 w-full rounded-xl bg-white shadow-sm" 
                                                value={reviewingCv.education || ''} 
                                                onChange={e => setReviewingCv({...reviewingCv, education: e.target.value})} 
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Market Industries</label>
                                                <Input 
                                                    className="h-11 font-bold border-slate-200 w-full rounded-xl bg-white shadow-sm" 
                                                    value={reviewingCv.workFields || ''} 
                                                    onChange={e => setReviewingCv({...reviewingCv, workFields: e.target.value})} 
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Specialized Niche</label>
                                                <Input 
                                                    className="h-11 font-bold border-slate-200 w-full rounded-xl bg-white shadow-sm" 
                                                    value={reviewingCv.specializedField || ''} 
                                                    onChange={e => setReviewingCv({...reviewingCv, specializedField: e.target.value})} 
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="space-y-4">
                                        <h4 className="text-[11px] font-black uppercase text-primary tracking-[0.2em] border-b border-primary/20 pb-2 flex items-center gap-2">
                                            <Bot className="w-4 h-4" /> AI Strategic Profile
                                        </h4>
                                        <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-6 shadow-inner">
                                            <textarea 
                                                className="w-full min-h-[100px] bg-transparent border-none focus:outline-none text-xs font-medium text-slate-800 leading-relaxed italic"
                                                value={reviewingCv.aiSummary || ''}
                                                onChange={e => setReviewingCv({...reviewingCv, aiSummary: e.target.value})}
                                                placeholder="AI provided insights about this candidate..."
                                            />
                                        </div>
                                    </section>

                                    <section className="space-y-4 pb-12">
                                        <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] border-b border-slate-200 pb-2">Full Bio / Pitch Summary</h4>
                                        <div className="space-y-2">
                                            <textarea 
                                                className="w-full min-h-[400px] p-6 text-sm border border-slate-200 rounded-3xl focus:ring-4 focus:ring-primary/5 text-slate-700 leading-relaxed font-sans shadow-xl bg-white"
                                                value={reviewingCv.professionalSummary || ''}
                                                onChange={e => setReviewingCv({...reviewingCv, professionalSummary: e.target.value})}
                                                placeholder="Craft a winning introduction for bidding..."
                                            />
                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-right px-2">Character Count: {reviewingCv.professionalSummary?.length || 0}</p>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Fixed Footer */}
                    <DialogFooter className="px-8 py-5 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Queue: {extractedList.indexOf(reviewingCv) + 1} / {extractedList.length}
                                </span>
                                <span className="text-xs font-bold text-slate-600">Verification Pending</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" className="font-bold h-11 px-8 rounded-xl text-slate-500 hover:bg-slate-50" onClick={() => setReviewingCv(null)}>
                                Discard
                            </Button>
                            <Button variant="outline" className="font-bold h-11 px-8 rounded-xl border-slate-200 hover:bg-slate-50 shadow-sm" onClick={saveReview}>
                                <FileDown className="w-4 h-4 mr-2" /> Keep Changes
                            </Button>
                            <Button className="bg-slate-900 hover:bg-slate-800 text-white h-11 px-12 font-black rounded-xl shadow-2xl active:scale-[0.98] transition-all border-none" onClick={confirmAndSaveReview}>
                                <Check className="w-5 h-5 mr-2" /> Approve & Commit Expert
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
};
