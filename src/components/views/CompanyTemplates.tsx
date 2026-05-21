import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Candidate, CompanyTemplate } from '../../types';
import { exportToWord, fillTemplate, getTemplateVariables } from '../../services/docxService';
import { geminiService } from '../../services/geminiService';
import { toast } from 'sonner';
import { Building2, FileText, Download, Eye, Columns, Upload, Trash2, Plus, Info, LayoutTemplate, CheckCircle2, Save, Wand2, Search } from 'lucide-react';
import { useAuth } from '../AuthProvider';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../lib/firestore-error';
import { formatCandidateName } from '../../lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmModal } from '@/components/ui/confirm-modal';

const PRESET_TEMPLATES: CompanyTemplate[] = [
    { id: 'bureau_veritas', name: 'Bureau Veritas', color: '#b20023', accent: '#8a001a', logo: '🛡️', country: 'France' },
    { id: 'petrobras', name: 'Petrobras', color: '#00AEEF', accent: '#005f8a', logo: '🏭', country: 'Brazil' },
    { id: 'shell', name: 'Shell', color: '#FFD700', accent: '#c5a600', logo: '🐚', country: 'Netherlands' },
    { id: 'exxon', name: 'ExxonMobil', color: '#FF0000', accent: '#b30000', logo: '⚡', country: 'USA' },
    { id: 'bp', name: 'BP', color: '#00A651', accent: '#007a3d', logo: '🌿', country: 'UK' },
    { id: 'chevron', name: 'Chevron', color: '#FF8C00', accent: '#cc7000', logo: '🔥', country: 'USA' },
    { id: 'standard', name: 'Standard Format', color: '#64748b', accent: '#475569', logo: '📄', country: 'Global' }
];

export const CompanyTemplates = ({ candidates: rawCandidates }: { candidates: Candidate[] }) => {
    const candidates = React.useMemo(() => rawCandidates.filter(c => {
        const cs = c.currentStatus?.toLowerCase() || (c as any).status?.toLowerCase();
        return cs !== 'deleted';
    }), [rawCandidates]);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDiscipline, setFilterDiscipline] = useState('All');
    
    const filteredCandidates = React.useMemo(() => {
        return candidates.filter(c => {
            const matchesSearch = c.candidateName?.toLowerCase().includes(searchTerm.toLowerCase()) || c.email?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesDiscipline = filterDiscipline === 'All' || c.discipline === filterDiscipline;
            return matchesSearch && matchesDiscipline;
        });
    }, [candidates, searchTerm, filterDiscipline]);
    
    // Extract unique disciplines for the filter dropdown
    const disciplines = React.useMemo(() => {
        const set = new Set<string>();
        candidates.forEach(c => { if (c.discipline) set.add(c.discipline); });
        return Array.from(set).sort();
    }, [candidates]);
    
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
    const [confirmDialog, setConfirmDialog] = useState<{title: string, message: string, onConfirm: () => void} | null>(null);

    // Fetch custom templates
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'templates'), where('ownerId', '==', user.uid));
        const unsub = onSnapshot(q, (snap) => {
            const temps = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as CompanyTemplate));
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
        if (vars.length === 0) {
            return toast.warning('Lỗi: Không tìm thấy thẻ {Biến} nào trong file Word. Vui lòng đọc Hướng dẫn và thêm các thẻ như {CANDIDATE_NAME} vào form trước khi tải lên.', { duration: 8000 });
        }

        setProcessingAI(true);
        try {
            toast.loading('AI đang phân tích cấu trúc và map dữ liệu...', { id: 'ai-map' });
            const result = await geminiService.mapCVToTemplate(cv.rawText, vars);
            setMappedData(result);
            setShowPreview(true);
            toast.success('AI Map dữ liệu thành công!', { id: 'ai-map' });
        } catch (error) {
            console.error(error);
            toast.error('AI Extraction lỗi. Vui lòng kiểm tra lại độ dài quá lớn hoặc sai định dạng thẻ.', { id: 'ai-map' });
        } finally {
            setProcessingAI(false);
        }
    };

    const saveCandidateChanges = async () => {
        if (!selectedCandidateId) return;
        try {
            toast.loading('Saving candidate information...', { id: 'save-cand' });
            const finalData = { ...editingCandidate } as any;
            if (finalData.candidateName) {
                finalData.candidateName = formatCandidateName(finalData.candidateName);
            }
            // Remove massive fields to avoid Firestore payload limits
            delete finalData.rawHtml;
            delete finalData.fileBase64;
            if (finalData.rawText && typeof finalData.rawText === 'string') {
                finalData.rawText = finalData.rawText.substring(0, 50000);
            }
            await updateDoc(doc(db, 'candidates', selectedCandidateId), {
                ...finalData,
                updatedAt: serverTimestamp()
            });
            toast.success('Cross-platform sync complete', { id: 'save-cand' });
        } catch (error: any) {
             handleFirestoreError(error, OperationType.UPDATE, `candidates/${selectedCandidateId}`);
        }
    };

    const runDetailedAI = async () => {
        if (!selectedCandidateId) return;
        const cv = candidates.find(c => c.id === selectedCandidateId);
        if (!cv?.rawText) return toast.error('No raw text available for this candidate.');
        
        try {
            setProcessingAI(true);
            toast.loading('AI is deeply parsing complex project and task tables...', { id: 'extract-detail' });
            
            const result = await geminiService.extractDetailedRecords(cv.rawText);
            
            setEditingCandidate(prev => ({
                ...prev,
                ...result
            }));
            
            toast.success('Successfully extracted detailed structured records! Please review and save.', { id: 'extract-detail' });
        } catch (error: any) {
            toast.error(error.message || 'Extract failed', { id: 'extract-detail' });
        } finally {
            setProcessingAI(false);
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

    const handleDeleteTemplate = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
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
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDialog({
                                        title: 'Are you sure?',
                                        message: `Do you want to delete the ${t.name} template?`,
                                        onConfirm: () => handleDeleteTemplate(t.id)
                                    });
                                }}
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
            
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-900 shadow-sm flex items-start gap-4">
                <Info className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div className="space-y-4 w-full">
                    <div>
                        <strong className="text-lg">Hướng dẫn Tạo & Tải lên Form CV Công Ty (File Word .docx)</strong>
                        <p className="mt-2 text-slate-700 leading-relaxed">
                            Để AI có thể trích xuất chính xác dữ liệu từ PDF/CV gốc và điền thẳng vào Form CV Word của công ty bạn, file Word tải lên <strong>BẮT BUỘC</strong> phải chứa các thẻ định danh (biến/variable) được bọc trong cặp ngoặc nhọn <code>{'{ }'}</code>. AI sẽ tự động đọc các thẻ này để mapping dữ liệu.
                        </p>
                    </div>

                    <div className="bg-white/60 p-4 rounded-lg border border-blue-100">
                        <strong className="text-blue-800">Các bước chuẩn bị File Word:</strong>
                        <ul className="list-decimal ml-5 mt-2 space-y-2 text-slate-700">
                            <li><strong>Thiết kế form chuẩn:</strong> Trình bày bảng biểu, logo, font chữ, bố cục đứng/ngang đúng theo yêu cầu Form CV của khách hàng (VD: PTSC, Vietsopetro...).</li>
                            <li><strong>Điền các Placeholder (Thẻ định danh):</strong> Gõ các thẻ sau vào những vị trí cần điền thông tin:
                                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 font-mono text-[11px] bg-slate-800 text-green-400 p-3 rounded-md">
                                    <div>{'{CANDIDATE_NAME}'} <span className="text-slate-400 font-sans">- Tên ứng viên</span></div>
                                    <div>{'{DISCIPLINE}'} <span className="text-slate-400 font-sans">- Vị trí/Chuyên ngành</span></div>
                                    <div>{'{EMAIL}'} <span className="text-slate-400 font-sans">- Email ứng viên</span></div>
                                    <div>{'{PHONE}'} <span className="text-slate-400 font-sans">- Số điện thoại</span></div>
                                    <div>{'{YEARS_EXP}'} <span className="text-slate-400 font-sans">- Số năm kinh nghiệm</span></div>
                                    <div>{'{SUMMARY}'} <span className="text-slate-400 font-sans">- Tóm tắt chung</span></div>
                                    <div className="col-span-1 md:col-span-2">{'{WORK_EXPERIENCE}'} <span className="text-slate-400 font-sans">- Kinh nghiệm làm việc chi tiết</span></div>
                                    <div className="col-span-1 md:col-span-2">{'{EDUCATION}'} <span className="text-slate-400 font-sans">- Quá trình học tập / Bằng cấp</span></div>
                                </div>
                            </li>
                            <li><strong>Các trường tùy chỉnh tự do:</strong> Bạn có thể tự đặt thêm bất kỳ biến nào bạn cần cho dự án, ví dụ <code>{'{CERTIFICATES}'}</code>, <code>{'{PROJECTS_LIST}'}</code>, <code>{'{SOFTWARE_SKILLS}'}</code>. Khi bạn bấm nút <b>AI Map Formats</b>, AI sẽ tự phân tích ngữ cảnh của từ khoá bên trong ngoặc nhọn để tìm ra đoạn thông tin tương ứng từ CV gốc và điền vào bản Word.</li>
                            <li><strong>Lưu lại dưới dạng định dạng <span className="text-blue-600 whitespace-nowrap">.docx</span></strong> và click <strong className="text-blue-600">New Template</strong> để tải lên. Bạn sẽ giữ được 100% định dạng, bảng biểu, style chữ ban đầu.</li>
                        </ul>
                    </div>

                    <div className="text-blue-800 font-medium">
                        💡 Lỗi "AI Map Formats" & "Extraction Failed" thường xảy ra nếu file template Word của bạn:
                        <ul className="list-disc ml-5 mt-1 font-normal text-slate-700">
                            <li>Thiếu dấu ngoặc nhọn, hoặc gõ sai ngoặc (vd: [Name], (Name) là sai, phải là <code>{'{Name}'}</code>).</li>
                            <li>Tải lên file định dạng cũ (.doc) thay vì (.docx).</li>
                            <li>File Word bị lỗi định dạng ẩn (hidden formatting) bên trong dấu ngoặc nhọn (vd copy-paste làm đứt gãy biến). Cách khắc phục: Bôi đen biến, chuột phải chọn "Keep Text Only" hoặc gõ lại bằng tay trực tiếp trên file Word.</li>
                        </ul>
                    </div>
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
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                        <div className="font-bold text-slate-700">1. Select Candidate:</div>
                        <div className="flex flex-col sm:flex-row gap-3">
                             <div className="relative">
                                 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                 <Input 
                                     placeholder="Search name or email..." 
                                     className="w-full sm:w-64 pl-9 h-10 border-slate-200"
                                     value={searchTerm}
                                     onChange={(e) => setSearchTerm(e.target.value)}
                                 />
                             </div>
                             <select 
                                 className="h-10 border border-slate-200 shadow-sm rounded-md px-3 text-sm font-medium text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none w-full sm:w-48 cursor-pointer"
                                 value={filterDiscipline} 
                                 onChange={(e) => setFilterDiscipline(e.target.value)}
                             >
                                 <option value="All">All Disciplines</option>
                                 {disciplines.map(d => (
                                     <option key={d} value={d}>{d}</option>
                                 ))}
                             </select>
                        </div>
                    </div>
                    
                    <div className="border border-slate-200 rounded-xl overflow-hidden mb-6 max-h-[300px] overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                                <tr>
                                    <th className="px-4 py-3 font-black text-[10px] text-slate-500 uppercase tracking-widest w-16 text-center">Select</th>
                                    <th className="px-4 py-3 font-black text-[10px] text-slate-500 uppercase tracking-widest">Name</th>
                                    <th className="px-4 py-3 font-black text-[10px] text-slate-500 uppercase tracking-widest">Discipline</th>
                                    <th className="px-4 py-3 font-black text-[10px] text-slate-500 uppercase tracking-widest w-24 text-center">Exp (Yrs)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {filteredCandidates.map(c => (
                                    <tr 
                                        key={c.id} 
                                        className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${selectedCandidateId === c.id ? 'bg-indigo-50/50' : ''}`}
                                        onClick={() => setSelectedCandidateId(c.id!)}
                                    >
                                        <td className="px-4 py-3 text-center">
                                            <div className={`w-4 h-4 rounded-full border-2 mx-auto flex items-center justify-center transition-all ${selectedCandidateId === c.id ? 'border-primary bg-primary scale-110 shadow-sm shadow-primary/30' : 'border-slate-300'}`}>
                                                {selectedCandidateId === c.id && <div className="w-1.5 h-1.5 bg-white rounded-full mx-auto" />}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`font-bold transition-colors ${selectedCandidateId === c.id ? 'text-primary' : 'text-slate-800'}`}>{c.candidateName}</span>
                                        </td>
                                        <td className="px-4 py-3"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">{c.discipline}</span></td>
                                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-500">{c.yearsExp}</td>
                                    </tr>
                                ))}
                                {filteredCandidates.length === 0 && (
                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 font-medium">No candidates match your search.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-end gap-3 w-full border-t border-slate-100 pt-5">
                            {selectedTemplate.isCustom && (
                                <Button 
                                    variant="outline" 
                                    className="h-11 px-5 font-bold rounded-xl border-slate-300 bg-amber-50 text-amber-700 hover:bg-amber-100 shadow-sm" 
                                    onClick={runAIExtraction}
                                    disabled={processingAI || !selectedCandidateId}
                                >
                                    <Wand2 className={`w-4 h-4 mr-2 ${processingAI ? 'animate-spin' : ''}`} />
                                    AI Map Formats
                                </Button>
                            )}

                            <Button 
                                variant="outline" 
                                className="h-11 px-5 font-bold rounded-xl border-slate-300 shadow-sm text-slate-700 hover:text-slate-900" 
                                onClick={() => {
                                    if(!selectedCandidateId) return toast.error('Select a CV first');
                                    setShowPreview(!showPreview);
                                }}
                            >
                                <Eye className="w-4 h-4 mr-2" />
                                {showPreview ? 'Hide Editor' : 'Edit & Review Info'}
                            </Button>

                            <Button 
                                className="h-11 px-8 font-bold rounded-xl shadow-lg transition-transform active:scale-95" 
                                style={{ backgroundColor: selectedTemplate.color, color: selectedTemplate.id === 'shell' ? '#000' : '#fff' }}
                                onClick={handleExport}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export to Word
                            </Button>
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
                                    <div className="flex items-center gap-2">
                                        {!selectedTemplate.isCustom && (
                                            <Button size="sm" variant="outline" onClick={runDetailedAI} disabled={processingAI || !selectedCandidateId} className="h-7 text-xs bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100">
                                                <Wand2 className={`w-3 h-3 mr-1 ${processingAI ? 'animate-spin' : ''}`} /> Re-extract Details (AI)
                                            </Button>
                                        )}
                                        {!selectedTemplate.isCustom && (
                                            <Button size="sm" variant="outline" onClick={saveCandidateChanges} className="h-7 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                                                <Save className="w-3 h-3 mr-1" /> Save to System
                                            </Button>
                                        )}
                                    </div>
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
                                            <div className="space-y-1.5 pt-2">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex justify-between">
                                                    <span>Full Professional History & Projects (AI Extracted)</span>
                                                </Label>
                                                <textarea 
                                                    className="text-sm min-h-[400px] leading-relaxed w-full p-3 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2" 
                                                    value={editingCandidate.detailedTasks || ''} 
                                                    onChange={e => setEditingCandidate({...editingCandidate, detailedTasks: e.target.value})} 
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

            <ConfirmModal 
                isOpen={!!confirmDialog}
                title={confirmDialog?.title || ''}
                message={confirmDialog?.message || ''}
                onConfirm={() => confirmDialog?.onConfirm()}
                onCancel={() => setConfirmDialog(null)}
            />
        </div>
    );
};

