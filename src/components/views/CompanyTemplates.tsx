import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Candidate, CompanyTemplate } from '../../types';
import { exportToWord, fillTemplate, getTemplateVariables } from '../../services/docxService';
import { geminiService } from '../../services/geminiService';
import { toast } from 'sonner';
import { Building2, FileText, Download, Eye, Columns, Upload, Trash2, Plus, Info, LayoutTemplate, CheckCircle2, Save, Wand2 } from 'lucide-react';
import { useAuth } from '../AuthProvider';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../lib/firestore-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const PRESET_TEMPLATES: CompanyTemplate[] = [
    { id: 'petrobras', name: 'Petrobras', color: '#00AEEF', accent: '#005f8a', logo: '🏭', country: 'Brazil' },
    { id: 'shell', name: 'Shell', color: '#FFD700', accent: '#c5a600', logo: '🐚', country: 'Netherlands' },
    { id: 'exxon', name: 'ExxonMobil', color: '#FF0000', accent: '#b30000', logo: '⚡', country: 'USA' },
    { id: 'bp', name: 'BP', color: '#00A651', accent: '#007a3d', logo: '🌿', country: 'UK' },
    { id: 'chevron', name: 'Chevron', color: '#FF8C00', accent: '#cc7000', logo: '🔥', country: 'USA' },
    { id: 'standard', name: 'Standard Format', color: '#64748b', accent: '#475569', logo: '📄', country: 'Global' }
];

export const CompanyTemplates = ({ candidates }: { candidates: Candidate[] }) => {
    const { user } = useAuth();
    const [selectedTemplate, setSelectedTemplate] = useState<CompanyTemplate>(PRESET_TEMPLATES[5]);
    const [customTemplates, setCustomTemplates] = useState<CompanyTemplate[]>([]);
    const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
    const [showPreview, setShowPreview] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [processingAI, setProcessingAI] = useState(false);
    const [mappedData, setMappedData] = useState<Record<string, any>>({});
    const [editingCandidate, setEditingCandidate] = useState<Partial<Candidate>>({});
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

    useEffect(() => {
        if (selectedCandidateId) {
            const c = candidates.find(can => can.id === selectedCandidateId);
            if (c) {
                setEditingCandidate(c);
                if (selectedTemplate.isCustom && selectedTemplate.fileBase64) {
                    const vars = getTemplateVariables(selectedTemplate.fileBase64);
                    const initData: any = {};
                    vars.forEach(v => {
                        // try to match with standard fields first
                        if(v === 'CANDIDATE_NAME') initData[v] = c.candidateName;
                        else if(v === 'EMAIL') initData[v] = c.email;
                        else if(v === 'PHONE') initData[v] = c.phone;
                        else if(v === 'YEARS_EXP') initData[v] = c.yearsExp;
                        else initData[v] = '';
                    });
                    setMappedData(initData);
                } else {
                    setMappedData({});
                }
            }
        }
    }, [selectedCandidateId, selectedTemplate, candidates]);

    const runAIExtraction = async () => {
        if (!selectedCandidateId || !selectedTemplate.isCustom || !selectedTemplate.fileBase64) return;
        const cv = candidates.find(c => c.id === selectedCandidateId);
        if (!cv?.rawText) return toast.error('No raw text available for this candidate.');
        
        const vars = getTemplateVariables(selectedTemplate.fileBase64);
        if (vars.length === 0) return toast.warning('No variables found in template to extract.');

        setProcessingAI(true);
        try {
            toast.loading('AI is analyzing structural template fields...', { id: 'ai-map' });
            const result = await geminiService.mapCVToTemplate(cv.rawText, vars);
            setMappedData(result);
            setShowPreview(true);
            toast.success('AI Data Mapping Complete', { id: 'ai-map' });
        } catch (error) {
            console.error(error);
            toast.error('AI Extraction failed.', { id: 'ai-map' });
        } finally {
            setProcessingAI(false);
        }
    };

    const saveCandidateChanges = async () => {
        if (!selectedCandidateId) return;
        try {
            toast.loading('Saving candidate information...', { id: 'save-cand' });
            await updateDoc(doc(db, 'candidates', selectedCandidateId), {
                ...editingCandidate,
                updatedAt: serverTimestamp()
            });
            toast.success('Cross-platform sync complete', { id: 'save-cand' });
        } catch (error: any) {
             handleFirestoreError(error, OperationType.UPDATE, `candidates/${selectedCandidateId}`);
        }
    };

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
            toast.promise(fillTemplate(mappedData, selectedTemplate.fileBase64, selectedTemplate.name), {
                loading: 'Applying template...',
                success: 'CV Exported successfully',
                error: 'Failed to fill template. Check variable names.'
            });
        } else {
            // First save what's in `editingCandidate` so it's consistent
            exportToWord(editingCandidate as Candidate, selectedTemplate.name);
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
                                    <SelectValue placeholder="— Select a CV/Expert —" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px] rounded-xl shadow-xl">
                                    {candidates.length === 0 && (
                                        <div className="p-4 text-center text-xs text-slate-400">No candidates found in the system.</div>
                                    )}
                                    {candidates.map(c => (
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
                        
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            {selectedTemplate.isCustom && (
                                <Button 
                                    variant="outline" 
                                    className="h-12 px-4 font-bold rounded-xl border-slate-200 bg-amber-50 text-amber-700 hover:bg-amber-100" 
                                    onClick={runAIExtraction}
                                    disabled={processingAI || !selectedCandidateId}
                                >
                                    <Wand2 className={`w-4 h-4 mr-2 ${processingAI ? 'animate-spin' : ''}`} />
                                    AI Map Formats
                                </Button>
                            )}

                            <Button 
                                variant="outline" 
                                className="h-12 px-4 font-bold rounded-xl border-slate-200 flex-1 md:flex-none" 
                                onClick={() => {
                                    if(!selectedCandidateId) return toast.error('Select a CV first');
                                    setShowPreview(!showPreview);
                                }}
                            >
                                <Eye className="w-4 h-4 mr-2" />
                                {showPreview ? 'Hide Editor' : 'Edit & Review Info'}
                            </Button>

                            <Button 
                                className="h-12 px-6 font-bold rounded-xl shadow-lg transition-transform active:scale-95 flex-1 md:flex-none" 
                                style={{ backgroundColor: selectedTemplate.color, color: selectedTemplate.id === 'shell' ? '#000' : '#fff' }}
                                onClick={handleExport}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export to Word
                            </Button>
                        </div>
                    </div>

                    {showPreview && selectedCandidateId && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-8 mt-8 border-t border-slate-100 animate-in slide-in-from-top-4">
                            {/* Raw Data Box */}
                            <div className="space-y-4">
                                <h6 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                                    <FileText className="w-3 h-3" /> Original Source Context
                                </h6>
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl h-[550px] overflow-y-auto text-[11px] text-slate-600 font-mono whitespace-pre-wrap leading-relaxed shadow-inner">
                                    {candidates.find(c => c.id === selectedCandidateId)?.rawText || 'No text available'}
                                </div>
                            </div>

                            {/* Editable Mapping Display Frame */}
                            <div className="space-y-4 flex flex-col h-[600px]">
                                <div className="flex items-center justify-between mb-2">
                                    <h6 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2" style={{ color: selectedTemplate.color }}>
                                        <Building2 className="w-3 h-3" /> Information Frame Editor ({selectedTemplate.name})
                                    </h6>
                                    {!selectedTemplate.isCustom && (
                                        <Button size="sm" variant="outline" onClick={saveCandidateChanges} className="h-7 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                                            <Save className="w-3 h-3 mr-1" /> Save to System
                                        </Button>
                                    )}
                                </div>
                                
                                <div className="p-6 bg-white border border-slate-200 rounded-2xl flex-1 overflow-y-auto shadow-sm relative" 
                                     style={{ borderTop: `8px solid ${selectedTemplate.color}` }}>
                                    
                                    {/* Edit Logic */}
                                    {selectedTemplate.isCustom ? (
                                        <div className="space-y-4">
                                            <p className="text-xs text-slate-500 mb-4 bg-slate-50 p-3 rounded-lg">
                                                These variables were automatically detected from your uploaded Word template. Fill them manually or click <b>"AI Map Formats"</b>.
                                            </p>
                                            {Object.keys(mappedData).map(key => (
                                                <div key={key} className="space-y-1.5">
                                                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                                        {key}
                                                    </Label>
                                                    {mappedData[key] && mappedData[key].length > 100 ? (
                                                        <textarea 
                                                            className="text-sm border border-slate-200 bg-slate-50/50 min-h-[100px] w-full p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2" 
                                                            value={mappedData[key] || ''} 
                                                            onChange={(e) => setMappedData({...mappedData, [key]: e.target.value})} 
                                                        />
                                                    ) : (
                                                        <Input 
                                                            className="text-sm border-slate-200 bg-slate-50/50" 
                                                            value={mappedData[key] || ''} 
                                                            onChange={(e) => setMappedData({...mappedData, [key]: e.target.value})} 
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Full Name</Label>
                                                    <Input className="text-sm" value={editingCandidate.candidateName || ''} onChange={e => setEditingCandidate({...editingCandidate, candidateName: e.target.value})} />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Discipline</Label>
                                                    <Input className="text-sm" value={editingCandidate.discipline || ''} onChange={e => setEditingCandidate({...editingCandidate, discipline: e.target.value})} />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Email</Label>
                                                    <Input className="text-sm" value={editingCandidate.email || ''} onChange={e => setEditingCandidate({...editingCandidate, email: e.target.value})} />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Phone</Label>
                                                    <Input className="text-sm" value={editingCandidate.phone || ''} onChange={e => setEditingCandidate({...editingCandidate, phone: e.target.value})} />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Years Experience</Label>
                                                    <Input type="number" className="text-sm" value={editingCandidate.yearsExp || 0} onChange={e => setEditingCandidate({...editingCandidate, yearsExp: parseFloat(e.target.value)})} />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Industry Expertise</Label>
                                                    <Input className="text-sm" value={editingCandidate.workFields || ''} onChange={e => setEditingCandidate({...editingCandidate, workFields: e.target.value})} />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5 pt-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Specialization</Label>
                                                <Input className="text-sm" value={editingCandidate.specializedField || ''} onChange={e => setEditingCandidate({...editingCandidate, specializedField: e.target.value})} />
                                            </div>
                                            <div className="space-y-1.5 pt-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex justify-between">
                                                    <span>Professional Summary <span className="text-indigo-500 lowercase opacity-70 ml-2">Appears in exported Word document</span></span>
                                                </Label>
                                                <textarea 
                                                    className="text-sm min-h-[150px] leading-relaxed w-full p-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2" 
                                                    value={editingCandidate.professionalSummary || ''} 
                                                    onChange={e => setEditingCandidate({...editingCandidate, professionalSummary: e.target.value})} 
                                                />
                                            </div>
                                            <div className="space-y-1.5 pt-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex justify-between">
                                                    <span>Education</span>
                                                </Label>
                                                <textarea 
                                                    className="text-sm min-h-[100px] leading-relaxed w-full p-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2" 
                                                    value={editingCandidate.education || ''} 
                                                    onChange={e => setEditingCandidate({...editingCandidate, education: e.target.value})} 
                                                />
                                            </div>
                                            <div className="space-y-1.5 pt-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex justify-between">
                                                    <span>Certifications</span>
                                                </Label>
                                                <textarea 
                                                    className="text-sm min-h-[80px] leading-relaxed w-full p-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2" 
                                                    value={editingCandidate.certifications || ''} 
                                                    onChange={e => setEditingCandidate({...editingCandidate, certifications: e.target.value})} 
                                                />
                                            </div>
                                            <div className="space-y-1.5 pt-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex justify-between">
                                                    <span>Key Skills</span>
                                                </Label>
                                                <textarea 
                                                    className="text-sm min-h-[80px] leading-relaxed w-full p-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2" 
                                                    value={editingCandidate.keySkills || ''} 
                                                    onChange={e => setEditingCandidate({...editingCandidate, keySkills: e.target.value})} 
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

