import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Candidate, CompanyTemplate } from '../../types';
import { exportToWord, fillTemplate } from '../../services/docxService';
import { toast } from 'sonner';
import { Building2, FileText, Download, Eye, Columns, Upload, Trash2, Plus, Info, LayoutTemplate, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../AuthProvider';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../lib/firestore-error';

const PRESET_TEMPLATES: CompanyTemplate[] = [
    { id: 'petrobras', name: 'Petrobras', color: '#00AEEF', accent: '#005f8a', logo: '🏭', country: 'Brazil' },
    { id: 'shell', name: 'Shell', color: '#FFD700', accent: '#c5a600', logo: '🐚', country: 'Netherlands' },
    { id: 'exxon', name: 'ExxonMobil', color: '#FF0000', accent: '#b30000', logo: '⚡', country: 'USA' },
    { id: 'bp', name: 'BP', color: '#00A651', accent: '#007a3d', logo: '🌿', country: 'UK' },
    { id: 'chevron', name: 'Chevron', color: '#FF8C00', accent: '#cc7000', logo: '🔥', country: 'USA' }
];

export const CompanyTemplates = ({ candidates }: { candidates: Candidate[] }) => {
    const { user } = useAuth();
    const [selectedTemplate, setSelectedTemplate] = useState<CompanyTemplate>(PRESET_TEMPLATES[0]);
    const [customTemplates, setCustomTemplates] = useState<CompanyTemplate[]>([]);
    const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
    const [showPreview, setShowPreview] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch custom templates
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'templates'), where('ownerId', '==', user.uid));
        const unsub = onSnapshot(q, (snap) => {
            const temps = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompanyTemplate));
            setCustomTemplates(temps);
        }, (error) => {
            handleFirestoreError(error, OperationType.LIST, 'templates');
        });
        return () => unsub();
    }, [user]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        if (!file.name.endsWith('.docx')) {
            return toast.error('Only .docx files are supported as templates');
        }

        setUploading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = (event.target?.result as string).split(',')[1];
                const path = 'templates';
                try {
                    await addDoc(collection(db, path), {
                        name: file.name.replace('.docx', ''),
                        fileBase64: base64,
                        ownerId: user.uid,
                        updatedAt: serverTimestamp(),
                        isCustom: true,
                        color: '#6366f1',
                        accent: '#4f46e5',
                        logo: '📄',
                        country: 'Custom'
                    });
                    toast.success('Template uploaded successfully');
                    setUploading(false);
                } catch (err) {
                    handleFirestoreError(err, OperationType.WRITE, path);
                }
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error(err);
            toast.error('Failed to read template file');
            setUploading(false);
        }
    };

    const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this custom template?')) return;
        const path = `templates/${id}`;
        try {
            await deleteDoc(doc(db, 'templates', id));
            if (selectedTemplate.id === id) setSelectedTemplate(PRESET_TEMPLATES[0]);
            toast.success('Template deleted');
        } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, path);
        }
    };

    const handleExport = async () => {
        if (!selectedCandidateId) return toast.error('Please select a CV first');
        const cv = candidates.find(c => c.id === selectedCandidateId);
        if (!cv) return toast.error('CV not found');
        
        if (selectedTemplate.isCustom && selectedTemplate.fileBase64) {
            toast.promise(fillTemplate(cv, selectedTemplate.fileBase64, selectedTemplate.name), {
                loading: 'Applying template...',
                success: 'CV Exported successfully',
                error: 'Failed to fill template. Check variable names.'
            });
        } else {
            exportToWord(cv, selectedTemplate.name);
            toast.success(`Exporting CV using ${selectedTemplate.name} template...`);
        }
    };

    const allTemplates = [...PRESET_TEMPLATES, ...customTemplates];

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-800 flex items-center gap-2">
                        <LayoutTemplate className="w-6 h-6 text-primary" />
                        Company Templates
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Format extracted CVs to match specific company standards or custom Word templates.</p>
                </div>
            </div>

            {/* Template Selection Grid */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                {allTemplates.map(t => (
                    <div 
                        key={t.id} 
                        className={`group relative p-4 rounded-xl cursor-pointer transition-all border-2 text-center h-full flex flex-col items-center justify-center ${selectedTemplate.id === t.id ? 'shadow-md scale-[1.02]' : 'border-transparent bg-white shadow-sm hover:border-slate-200'}`}
                        style={{ borderColor: selectedTemplate.id === t.id ? t.color : '' }}
                        onClick={() => setSelectedTemplate(t)}
                    >
                        <div className="text-2xl mb-2">{t.logo}</div>
                        <h6 className="font-bold text-xs truncate w-full" style={{ color: t.color }}>{t.name}</h6>
                        <p className="text-[9px] uppercase tracking-widest text-slate-400 mt-1">{t.country}</p>
                        
                        {t.isCustom && (
                            <button 
                                onClick={(e) => handleDeleteTemplate(t.id, e)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        )}
                        {selectedTemplate.id === t.id && (
                            <div className="absolute top-2 right-2">
                                <CheckCircle2 className="w-3 h-3" style={{ color: t.color }} />
                            </div>
                        )}
                    </div>
                ))}
                
                {/* Upload Button */}
                <div 
                    className="p-4 rounded-xl cursor-pointer transition-all border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:text-primary hover:border-primary"
                    onClick={() => fileInputRef.current?.click()}
                >
                    {uploading ? <Upload className="w-6 h-6 animate-bounce" /> : <Plus className="w-6 h-6" />}
                    <span className="text-[10px] font-black uppercase tracking-widest mt-2">{uploading ? 'Uploading...' : 'New Template'}</span>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept=".docx" 
                        onChange={handleFileUpload} 
                    />
                </div>
            </div>

            <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-black text-slate-800">CV Formatter</CardTitle>
                            <CardDescription>Select a reviewed candidate and apply the <b>{selectedTemplate.name}</b> template.</CardDescription>
                        </div>
                        {selectedTemplate.isCustom && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg">
                                <Info className="w-3.5 h-3.5 text-indigo-500" />
                                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight">Custom Template Active</span>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="flex-1 w-full">
                            <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId}>
                                <SelectTrigger className="h-12 bg-white border-slate-200 rounded-xl shadow-sm focus:ring-primary/20">
                                    <SelectValue placeholder="— Select a Confirmed Candidate —" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px] rounded-xl shadow-xl">
                                    {candidates.filter(c => c.confirmed).length === 0 && (
                                        <div className="p-4 text-center text-xs text-slate-400">No confirmed candidates found. Please review and confirm in CV Extraction.</div>
                                    )}
                                    {candidates.filter(c => c.confirmed).map(c => (
                                        <SelectItem key={c.id} value={c.id!} className="rounded-lg">
                                            <div className="flex flex-col py-1">
                                                <span className="font-bold text-slate-800">{c.candidateName}</span>
                                                <span className="text-[10px] text-slate-400 uppercase tracking-widest">{c.discipline} • {c.yearsExp} Years Exp</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <Button 
                                variant="outline" 
                                className="h-12 px-6 font-bold rounded-xl border-slate-200 flex-1 md:flex-none" 
                                onClick={() => {
                                    if(!selectedCandidateId) return toast.error('Select a CV first');
                                    setShowPreview(!showPreview);
                                }}
                            >
                                <Eye className="w-4 h-4 mr-2" />
                                Review Extracted Info
                            </Button>

                            <Button 
                                className="h-12 px-8 font-bold rounded-xl shadow-lg transition-transform active:scale-95 flex-1 md:flex-none" 
                                style={{ backgroundColor: selectedTemplate.color, color: selectedTemplate.id === 'shell' ? '#000' : '#fff' }}
                                onClick={handleExport}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export to Word
                            </Button>
                        </div>
                    </div>

                    {selectedTemplate.isCustom && (
                        <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                            <Info className="w-5 h-5 text-amber-500 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-amber-800">Template Variable Guide</p>
                                <p className="text-[10px] text-amber-700 mt-1 leading-relaxed">
                                    Your Word document should contain variables inside curly braces: 
                                    <code className="mx-1 px-1 bg-amber-100 rounded">{"{CANDIDATE_NAME}"}</code>, 
                                    <code className="mx-1 px-1 bg-amber-100 rounded">{"{EMAIL}"}</code>, 
                                    <code className="mx-1 px-1 bg-amber-100 rounded">{"{PROFESSIONAL_SUMMARY}"}</code>, etc.
                                </p>
                            </div>
                        </div>
                    )}

                    {showPreview && selectedCandidateId && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 mt-8 border-t border-slate-100 animate-in slide-in-from-top-4">
                            {/* Raw Data Box */}
                            <div className="space-y-3">
                                <h6 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                    <FileText className="w-3 h-3" /> Original Source Context
                                </h6>
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl h-[450px] overflow-y-auto text-[11px] text-slate-600 font-mono whitespace-pre-wrap leading-relaxed shadow-inner">
                                    {candidates.find(c => c.id === selectedCandidateId)?.rawText || 'No text available'}
                                </div>
                            </div>

                            {/* Info Display Frame */}
                            <div className="space-y-3">
                                <h6 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2" style={{ color: selectedTemplate.color }}>
                                    <Building2 className="w-3 h-3" /> Information Frame ({selectedTemplate.name})
                                </h6>
                                <div className="p-8 bg-white border border-slate-200 rounded-2xl h-[450px] overflow-y-auto shadow-sm relative overflow-hidden" 
                                     style={{ borderTop: `8px solid ${selectedTemplate.color}` }}>
                                    
                                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none text-6xl">
                                        {selectedTemplate.logo}
                                    </div>

                                    {(() => {
                                        const cv = candidates.find(c => c.id === selectedCandidateId);
                                        if (!cv) return null;
                                        return (
                                            <div className="space-y-8">
                                                <header className="border-b border-slate-100 pb-6">
                                                    <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">{cv.candidateName}</h3>
                                                    <p className="text-primary font-bold mt-1 text-sm">{cv.discipline} • {cv.yearsExp} Years Professional Experience</p>
                                                    <div className="flex gap-4 mt-4 text-[11px] text-slate-500 font-medium">
                                                        <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {cv.email}</span>
                                                        <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {cv.phone}</span>
                                                    </div>
                                                </header>

                                                <div className="grid grid-cols-2 gap-8">
                                                    <section className="space-y-1">
                                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Specialization</p>
                                                        <p className="text-xs font-bold text-slate-700">{cv.specializedField}</p>
                                                    </section>
                                                    <section className="space-y-1">
                                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Industry Expertise</p>
                                                        <p className="text-xs font-bold text-slate-700">{cv.workFields}</p>
                                                    </section>
                                                </div>

                                                <section className="space-y-2">
                                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50 pb-1 flex items-center justify-between">
                                                        Professional Summary
                                                        <span className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">AI Generated</span>
                                                    </p>
                                                    <p className="text-xs text-slate-600 leading-relaxed font-serif italic border-l-2 border-slate-100 pl-4 py-2">
                                                        {cv.professionalSummary || 'No summary available.'}
                                                    </p>
                                                </section>

                                                <section className="space-y-2">
                                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50 pb-1">Education</p>
                                                    <p className="text-xs text-slate-700 font-bold">{cv.education || 'Bachelor Degree in Engineering'}</p>
                                                </section>

                                                <div className="pt-6 mt-8 border-t border-slate-50 flex items-center justify-between text-[8px] text-slate-300 font-black uppercase tracking-widest">
                                                    <span>Generated by CV Extraction Pro</span>
                                                    <span>Formated for: {selectedTemplate.name}</span>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

