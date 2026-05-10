import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Candidate, CandidateStatus } from '../../types';
import { Users, Trash2, Download, Eye, ArchiveRestore, HardDrive, Ban, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDisciplines } from '../../hooks/useDisciplines';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { exportToExcelWithPivots } from '../../lib/excel-export';

export const PersonnelDirectory = ({ 
    candidates, 
    onStatusChange, 
    onDisciplineChange,
    onDelete,
    onEmptyTrash 
}: { 
    candidates: Candidate[], 
    onStatusChange: (id: string, st: CandidateStatus) => void,
    onDisciplineChange?: (id: string, discipline: string) => void,
    onDelete: (id: string) => void,
    onEmptyTrash?: () => void
}) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [viewTab, setViewTab] = useState<'active' | 'rejected' | 'trash'>('active');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [disciplineFilter, setDisciplineFilter] = useState<string>('All');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const { disciplineDetails, disciplines: catalogDisciplines } = useDisciplines();
    
    const [confirmDialog, setConfirmDialog] = useState<{title: string, message: string, onConfirm: () => void} | null>(null);
    
    const filteredList: Candidate[] = candidates.filter(c => {
        const cs = c.currentStatus?.toLowerCase() || (c as any).status?.toLowerCase();
        
        let tabMatch = false;
        if (viewTab === 'trash') {
            tabMatch = cs === 'deleted';
        } else if (viewTab === 'rejected') {
            tabMatch = cs === 'rejected';
        } else {
            tabMatch = cs !== 'deleted' && cs !== 'rejected';
        }
        
        if (!tabMatch) return false;

        if (viewTab === 'active' && statusFilter !== 'All') {
            if (cs !== statusFilter.toLowerCase()) return false;
        }

        if (disciplineFilter && disciplineFilter !== 'All') {
            if (c.discipline !== disciplineFilter) return false;
        }

        if (dateFrom || dateTo) {
            const addedAtMs = c.addedAt ? new Date(c.addedAt).getTime() : 0;
            if (addedAtMs > 0) {
                if (dateFrom) {
                    const fromMs = new Date(dateFrom).getTime();
                    if (addedAtMs < fromMs) return false;
                }
                if (dateTo) {
                    const toDate = new Date(dateTo);
                    toDate.setHours(23, 59, 59, 999);
                    if (addedAtMs > toDate.getTime()) return false;
                }
            }
        }

        return true;
    });
    const displayList = [...filteredList];
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    const totalPages = Math.ceil(displayList.length / ITEMS_PER_PAGE);
    const paginatedList = displayList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    // Reset pagination when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [viewTab, statusFilter, disciplineFilter, dateFrom, dateTo]);

    const toggleSelectAll = () => {
        if (selectedIds.length === paginatedList.length) setSelectedIds([]);
        else setSelectedIds(paginatedList.map(c => c.id!));
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleBulkDelete = () => {
        if (!confirm('Are you sure you want to delete these records?')) return;
        selectedIds.forEach(id => onDelete(id));
        setSelectedIds([]);
        toast.info('Records deleted');
    };

    const handleBulkStatus = (st: CandidateStatus) => {
        selectedIds.forEach(id => onStatusChange(id, st));
        setSelectedIds([]);
        toast.success(`Updated status to ${st}`);
    };

    const handleRowDisciplineChange = (id: string, newDiscipline: string) => {
        if (onDisciplineChange) onDisciplineChange(id, newDiscipline);
    };

    const handleExportExcel = () => {
        if (candidates.length === 0) {
            toast.error("No data to export");
            return;
        }

        exportToExcelWithPivots(filteredList, 'Personnel_Directory');
        toast.success('Exported to Excel with pivot summaries successfully!');
    };

    const getInitials = (name: string) => {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    return (
        <Card className="border-none shadow-sm animate-in fade-in duration-300">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-6 flex flex-row items-start justify-between">
                <div>
                    <CardTitle className="text-2xl font-black flex items-center gap-2 text-slate-900">
                        <Users className="w-6 h-6 text-primary" />
                        Personnel Directory
                    </CardTitle>
                    <CardDescription className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Master list of all candidates with status tracking</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                    <Tabs value={viewTab} onValueChange={(val) => setViewTab(val as any)} className="w-auto">
                        <TabsList className="bg-slate-100 p-1">
                            <TabsTrigger value="active" className="font-bold text-[10px] uppercase tracking-wider px-3 h-7">Active</TabsTrigger>
                            <TabsTrigger value="rejected" className="font-bold text-[10px] uppercase tracking-wider px-3 h-7">Rejected</TabsTrigger>
                            <TabsTrigger value="trash" className="font-bold text-[10px] uppercase tracking-wider px-3 h-7">Trash</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    {viewTab === 'trash' && onEmptyTrash && (
                        <Button 
                            variant="outline" 
                            className="font-bold text-xs uppercase tracking-wider text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 rounded-lg h-9"
                            onClick={() => setConfirmDialog({
                                title: 'Empty Trash?',
                                message: 'Are you sure you want to permanently delete all records in the trash? This cannot be undone.',
                                onConfirm: onEmptyTrash
                            })}
                        >
                            <HardDrive className="w-4 h-4 mr-2" />
                            Empty Trash
                        </Button>
                    )}
                    <Button onClick={handleExportExcel} className="font-bold text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg h-9">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-4 bg-slate-50">
                <div className="flex flex-wrap items-end gap-3 mb-4">
                    {viewTab === 'active' && (
                        <>
                            <div className="flex flex-col gap-1 w-full sm:w-auto">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">
                                    DISCIPLINE
                                </label>
                                <select 
                                    className="h-8 px-2 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 ring-primary/20 w-full sm:w-[150px] cursor-pointer"
                                    value={disciplineFilter} 
                                    onChange={(e) => setDisciplineFilter(e.target.value)}
                                >
                                    <option value="All">All Disciplines</option>
                                    {catalogDisciplines.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1 w-full sm:w-auto">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">
                                    STATUS FILTER
                                </label>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full sm:w-[150px] h-8 text-[11px] font-bold bg-white rounded-lg border-slate-200">
                                        <SelectValue placeholder="All Statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Active</SelectItem>
                                        <SelectItem value="New">New</SelectItem>
                                        <SelectItem value="Reviewing">Reviewing</SelectItem>
                                        <SelectItem value="Shortlisted">Shortlisted</SelectItem>
                                        <SelectItem value="Hired">Hired</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}
                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">
                            FROM DATE
                        </label>
                        <input 
                            type="date" 
                            className="h-8 px-2 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 ring-primary/20 w-full sm:w-[130px]"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">
                            TO DATE
                        </label>
                        <input 
                            type="date" 
                            className="h-8 px-2 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 ring-primary/20 w-full sm:w-[130px]"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                        />
                    </div>
                    {(statusFilter !== 'All' || dateFrom || dateTo) && (
                        <Button 
                            variant="ghost" 
                            onClick={() => { setStatusFilter('All'); setDateFrom(''); setDateTo(''); }}
                            className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 h-8"
                        >
                            Clear Filters
                        </Button>
                    )}
                </div>

                {selectedIds.length > 0 && (
                    <div className="bg-primary/5 p-4 flex items-center justify-between border border-primary/20 rounded-xl mb-4">
                        <span className="text-sm font-bold text-primary">{selectedIds.length} selected</span>
                        <div className="flex items-center gap-2">
                            <Select onValueChange={handleBulkStatus}>
                                <SelectTrigger className="w-[180px] h-9 text-xs bg-white rounded-lg">
                                    <SelectValue placeholder="Set Status..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="New">New</SelectItem>
                                    <SelectItem value="Reviewing">Reviewing</SelectItem>
                                    <SelectItem value="Shortlisted">Shortlisted</SelectItem>
                                    <SelectItem value="Hired">Hired</SelectItem>
                                    <SelectItem value="Rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-red-600 border-red-200 hover:bg-red-50 rounded-lg"
                                onClick={() => setConfirmDialog({
                                    title: 'Are you sure?',
                                    message: `This will delete ${selectedIds.length} records.`,
                                    onConfirm: () => {
                                        selectedIds.forEach(id => onDelete(id));
                                        setSelectedIds([]);
                                        toast.info('Records deleted');
                                    }
                                })}
                            >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </Button>
                        </div>
                    </div>
                )}
                <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-[11px] font-black uppercase tracking-widest text-slate-900 border-b-2 border-slate-200">
                            <tr>
                                <th className="p-4 w-12 text-center">
                                    <Checkbox 
                                        checked={selectedIds.length === paginatedList.length && paginatedList.length > 0}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="p-4 w-[16%]">NAME</th>
                                <th className="p-4 w-[10%]">EMAIL</th>
                                <th className="p-4 w-[10%]">PHONE</th>
                                <th className="p-4 w-[5%]">EXP</th>
                                <th className="p-4 w-[12%]">EDUCATION</th>
                                <th className="p-4 w-[12%]">INDUSTRIES</th>
                                <th className="p-4 w-[12%]">SPECIALIZED FIELD</th>
                                <th className="p-4 w-[12%]">DISCIPLINE</th>
                                <th className="p-4 w-[8%]">STATUS</th>
                                <th className="p-4 w-24 text-center">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedList.map(c => (
                                <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(c.id!) ? 'bg-primary/5' : ''}`}>
                                    <td className="p-4 text-center">
                                        <Checkbox 
                                            checked={selectedIds.includes(c.id!)}
                                            onCheckedChange={() => toggleSelect(c.id!)}
                                        />
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-[#6366f1] text-white flex shrink-0 items-center justify-center font-bold text-[10px]">
                                                {getInitials(c.candidateName)}
                                            </div>
                                            <span className="font-black text-slate-900 text-xs leading-tight break-words whitespace-normal inline-block">{c.candidateName}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {c.email ? (
                                            <a href={`mailto:${c.email}`} className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline block truncate max-w-[150px]" title={c.email}>
                                                {c.email}
                                            </a>
                                        ) : <span className="text-[11px] text-slate-400">---</span>}
                                    </td>
                                    <td className="p-4">
                                        {c.phone ? (
                                            <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">{c.phone}</span>
                                        ) : <span className="text-[11px] text-slate-400">---</span>}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="inline-flex items-center justify-center min-w-[2.5rem] h-7 px-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-black text-xs shadow-sm">
                                            {c.yearsExp}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-[11px] font-bold text-slate-500 whitespace-normal break-words min-w-[100px] block border-b border-dotted border-slate-300" title={c.education}>{c.education || '---'}</span>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-[11px] font-bold text-slate-500 whitespace-normal break-words min-w-[100px] block border-b border-dotted border-slate-300" title={c.workFields}>{c.workFields || '---'}</span>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-[11px] font-bold text-slate-500 whitespace-normal break-words min-w-[100px] block border-b border-dotted border-slate-300" title={c.specializedField}>{c.specializedField || '---'}</span>
                                    </td>
                                    <td className="p-4">
                                        <Select 
                                            value={c.discipline || ''} 
                                            onValueChange={(val) => handleRowDisciplineChange(c.id!, val)}
                                        >
                                            <SelectTrigger className="h-7 px-2.5 text-[10px] font-bold uppercase w-full max-w-[180px] min-w-[100px] rounded-lg text-indigo-700 bg-indigo-50 border-indigo-200 shrink-0">
                                                <SelectValue placeholder="Select discipline">{c.discipline}</SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {disciplineDetails.map((d: any) => (
                                                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="p-4">
                                        <Select 
                                            value={c.currentStatus} 
                                            onValueChange={(val) => onStatusChange(c.id!, val as CandidateStatus)}
                                        >
                                            <SelectTrigger className="h-8 text-[11px] font-bold w-[120px] rounded-full text-slate-700 bg-white border-slate-200">
                                                <SelectValue>{c.currentStatus}</SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="New">New</SelectItem>
                                                <SelectItem value="Reviewing">Reviewing</SelectItem>
                                                <SelectItem value="Shortlisted">Shortlisted</SelectItem>
                                                <SelectItem value="Hired">Hired</SelectItem>
                                                <SelectItem value="Rejected">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {c.currentStatus?.toLowerCase() === 'deleted' ? (
                                                <button 
                                                    className="w-8 h-8 rounded-full hover:bg-emerald-50 text-emerald-400 hover:text-emerald-500 inline-flex items-center justify-center transition-colors"
                                                    onClick={() => {
                                                        onStatusChange(c.id!, 'New');
                                                        toast.success('Record restored to active list');
                                                    }}
                                                    title="Restore"
                                                >
                                                    <ArchiveRestore className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <Dialog>
                                                    <DialogTrigger className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 inline-flex items-center justify-center">
                                                        <Eye className="w-4 h-4" />
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-[96vw] sm:max-w-[96vw] md:max-w-[96vw] lg:max-w-[96vw] w-full h-[96vh] flex flex-col p-0 overflow-hidden bg-slate-50 border-none sm:rounded-2xl transition-all duration-300">
                                                        {/* Header */}
                                                        <div className="bg-white border-b border-slate-100 p-4 lg:p-6 flex items-center justify-between shrink-0">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg lg:text-xl font-black shadow-lg shadow-indigo-600/20">
                                                                    {getInitials(c.candidateName)}
                                                                </div>
                                                                <div>
                                                                    <DialogTitle className="text-xl lg:text-2xl font-black text-slate-900">{c.candidateName}</DialogTitle>
                                                                    <div className="mt-1.5 flex flex-wrap items-center gap-2 lg:gap-3">
                                                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-800 border-indigo-200 font-bold uppercase tracking-wider text-[10px] lg:text-[11px] px-2.5 py-0.5">
                                                                            {c.discipline}
                                                                        </Badge>
                                                                        <div className="text-xs lg:text-sm font-medium text-slate-500 flex items-center gap-1">
                                                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                                            {c.currentStatus}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                {(c.driveFileUrl || c.fileUrl) && (
                                                                    <Button size="sm" onClick={() => window.open(c.driveFileUrl || c.fileUrl, '_blank')} className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-sm font-bold h-9">
                                                                        <ExternalLink className="w-4 h-4" />
                                                                        <span className="hidden sm:inline">Open Original CV</span>
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Split View */}
                                                        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-100/50">
                                                            {/* Left: Document Preview */}
                                                            <div className="hidden lg:flex w-[65%] border-r border-slate-200 bg-slate-200 p-2 lg:p-4">
                                                                {(c.driveFileUrl || c.fileUrl) ? (
                                                                    <iframe 
                                                                        src={(c.driveFileUrl || c.fileUrl || '').replace(/\/view.*$/, '/preview')}
                                                                        className="w-full h-full rounded-xl shadow-sm bg-white"
                                                                        title="CV Preview"
                                                                    />
                                                                ) : (
                                                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-100 rounded-xl shadow-inner">
                                                                        <Eye className="w-12 h-12 mb-3 text-slate-300" />
                                                                        <p className="font-medium">No document available for preview</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            
                                                            {/* Right: Condensed Info */}
                                                            <div className="w-full lg:w-[35%] overflow-y-auto p-4 lg:p-6 space-y-5 bg-white">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="space-y-1">
                                                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Experience</p>
                                                                        <p className="font-bold text-slate-700 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg inline-block">{c.yearsExp} Years</p>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">AI Score</p>
                                                                        <p className="font-black text-indigo-600 text-lg px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg inline-block">{c.aiScore}/100</p>
                                                                    </div>
                                                                </div>

                                                                {(c.email || c.phone) && (
                                                                    <div className="space-y-3 pt-2">
                                                                        {c.email && (
                                                                            <div className="space-y-1">
                                                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Email</p>
                                                                                <p className="font-bold text-sm text-blue-600 truncate">{c.email}</p>
                                                                            </div>
                                                                        )}
                                                                        {c.phone && (
                                                                            <div className="space-y-1">
                                                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Phone</p>
                                                                                <p className="font-bold text-sm text-slate-700">{c.phone}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                
                                                                <hr className="border-slate-100 my-4" />

                                                                {c.professionalSummary && (
                                                                    <div className="space-y-2">
                                                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Summary</p>
                                                                        <p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                                                                            {c.professionalSummary}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {c.keySkills && (
                                                                    <div className="space-y-2 pt-2">
                                                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Key Skills</p>
                                                                        <p className="text-sm font-semibold text-slate-700 whitespace-pre-wrap">
                                                                            {c.keySkills}
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                {(c.education || c.certifications) && (
                                                                    <div className="space-y-5 pt-2">
                                                                        {c.education && (
                                                                            <div className="space-y-2">
                                                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Education</p>
                                                                                <p className="text-xs font-medium text-slate-600">{c.education}</p>
                                                                            </div>
                                                                        )}
                                                                        {c.certifications && (
                                                                            <div className="space-y-2">
                                                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Certifications</p>
                                                                                <p className="text-xs font-medium text-slate-600">{c.certifications}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            )}
                                            <button 
                                                className="w-8 h-8 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 inline-flex items-center justify-center transition-colors"
                                                onClick={() => setConfirmDialog({
                                                    title: 'Are you sure?',
                                                    message: c.currentStatus?.toLowerCase() === 'deleted' ? 'Permanently remove this record?' : 'Move this record to trash?',
                                                    onConfirm: () => onDelete(c.id!)
                                                })}
                                                title={c.currentStatus?.toLowerCase() === 'deleted' ? 'Purge' : 'Delete'}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {paginatedList.length === 0 && (
                                <tr>
                                    <td colSpan={11} className="p-10 text-center text-slate-400 italic font-medium">
                                        No personnel records found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, displayList.length)} of {displayList.length}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="h-8 text-xs font-bold border-slate-200"
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="h-8 text-xs font-bold border-slate-200"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
            
            <ConfirmModal 
                isOpen={!!confirmDialog}
                title={confirmDialog?.title || ''}
                message={confirmDialog?.message || ''}
                onConfirm={() => confirmDialog?.onConfirm()}
                onCancel={() => setConfirmDialog(null)}
            />
        </Card>
    );
};
