import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Candidate, CandidateStatus } from '../../types';
import { Users, Trash2, Download, Eye, ArchiveRestore, HardDrive, Ban } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDisciplines } from '../../hooks/useDisciplines';
import { ConfirmModal } from '@/components/ui/confirm-modal';

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
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const { disciplineDetails } = useDisciplines();
    
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
    }, [viewTab, statusFilter, dateFrom, dateTo]);

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

        const dataToExport = candidates.map((c, index) => ({
            'No': index + 1,
            'Name': c.candidateName,
            'Discipline': c.discipline,
            'Experience': c.yearsExp,
            'Education': c.education,
            'Industries': c.workFields,
            'Specialization': c.specializedField,
            'Email': c.email,
            'Phone': c.phone,
            'Status': c.currentStatus,
            'Added At': c.addedAt && !isNaN(new Date(c.addedAt).getTime()) ? new Date(c.addedAt).toLocaleDateString() : 'N/A'
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Personnel_Directory");
        XLSX.writeFile(wb, "Personnel_Directory.xlsx");
        toast.success('Exported to Excel successfully!');
    };

    const getInitials = (name: string) => {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    return (
        <Card className="border-none shadow-sm animate-in fade-in duration-300">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-6 flex flex-row items-start justify-between">
                <div>
                    <CardTitle className="text-xl font-black flex items-center gap-2">
                        <Users className="w-6 h-6 text-primary" />
                        Personnel Directory
                    </CardTitle>
                    <CardDescription className="text-slate-500 font-semibold uppercase text-[9px] tracking-widest mt-1">Master list of all candidates with status tracking</CardDescription>
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
                        <div className="flex flex-col gap-1 w-full sm:w-auto">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">
                                STATUS FILTER
                            </label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full sm:w-[150px] h-8 text-[11px] font-bold bg-white rounded-lg">
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
                        <thead className="bg-slate-50/80 text-[10px] font-black uppercase tracking-widest text-[#64748b] border-b border-slate-200">
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
                                            <span className="font-bold text-slate-800 text-[11px] leading-tight break-words whitespace-normal inline-block">{c.candidateName}</span>
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
                                    <td className="p-4 text-slate-600 font-bold text-[11px] tabular-nums">{c.yearsExp}</td>
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
                                            <SelectTrigger className="h-7 px-2 text-[9px] font-bold uppercase w-full max-w-[180px] min-w-[100px] rounded-full text-slate-600 bg-white border-slate-200">
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
                                                    <DialogContent className="max-w-md sm:max-w-2xl bg-white border-slate-200 p-0 overflow-hidden">
                                                        <div className="bg-slate-50 border-b border-slate-100 p-6 flex items-center gap-4">
                                                            <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-primary/20">
                                                                {getInitials(c.candidateName)}
                                                            </div>
                                                            <div>
                                                                <DialogTitle className="text-2xl font-black text-slate-800">{c.candidateName}</DialogTitle>
                                                                <div className="text-sm font-semibold text-slate-500 mt-1 uppercase tracking-wider">{c.discipline}</div>
                                                            </div>
                                                        </div>
                                                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">
                                                            <div className="space-y-4">
                                                                <div>
                                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Experience</div>
                                                                    <div className="text-slate-800 font-medium">{c.yearsExp} Years</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Specialization</div>
                                                                    <div className="text-slate-800">{c.specializedField || 'N/A'}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Work Fields</div>
                                                                    <div className="text-slate-800">{c.workFields || 'N/A'}</div>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-4">
                                                                <div>
                                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</div>
                                                                    <Badge variant="outline" className={`
                                                                        px-3 py-1 text-xs uppercase
                                                                        ${c.currentStatus === 'Hired' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : ''}
                                                                        ${c.currentStatus === 'Shortlisted' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : ''}
                                                                        ${c.currentStatus === 'Rejected' ? 'bg-red-50 text-red-600 border-red-200' : ''}
                                                                        ${c.currentStatus?.toLowerCase() === 'deleted' ? 'bg-orange-50 text-orange-600 border-orange-200' : ''}
                                                                        ${c.currentStatus === 'New' || c.currentStatus === 'Reviewing' ? 'bg-slate-50 text-slate-600 border-slate-200' : ''}
                                                                    `}>
                                                                        {c.currentStatus}
                                                                    </Badge>
                                                                </div>
                                                                <div>
                                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">AI Score</div>
                                                                    <div className="text-slate-800 font-black text-xl text-primary">{c.aiScore}/100</div>
                                                                </div>
                                                                {c.driveFileUrl && (
                                                                    <div>
                                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Google Drive</div>
                                                                        <a href={c.driveFileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm font-medium">View Original CV</a>
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
