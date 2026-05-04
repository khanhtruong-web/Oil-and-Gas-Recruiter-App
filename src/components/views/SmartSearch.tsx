import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Eye, Trash2, ExternalLink } from 'lucide-react';
import { Candidate, CandidateStatus } from '../../types';
import { useDisciplines } from '../../hooks/useDisciplines';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { exportToExcelWithPivots } from '../../lib/excel-export';
import { toast } from 'sonner';

interface SmartSearchProps {
    candidates: Candidate[];
    onStatusChange?: (id: string, status: CandidateStatus) => void;
    onDelete?: (id: string) => void;
}

export const SmartSearch = ({ candidates, onStatusChange, onDelete }: SmartSearchProps) => {
    const { disciplines: DISCIPLINE_CATALOG } = useDisciplines();
    const [query, setQuery] = useState('');
    const [discipline, setDiscipline] = useState('All');
    const [minExp, setMinExp] = useState<string>('');
    const [maxExp, setMaxExp] = useState<string>('');
    const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<{title: string, message: string, onConfirm: () => void} | null>(null);

    const filtered = candidates.filter(cv => {
        const cs = cv.currentStatus?.toLowerCase() || (cv as any).status?.toLowerCase();
        if (cs === 'deleted') return false;
        const yrs = cv.yearsExp || 0;
        if (discipline !== 'All' && cv.discipline !== discipline) return false;
        if (minExp && yrs < parseInt(minExp)) return false;
        if (maxExp && yrs > parseInt(maxExp)) return false;
        if (query) {
            const h = `${cv.candidateName} ${cv.workFields} ${cv.specializedField} ${cv.discipline}`.toLowerCase();
            if (!h.includes(query.toLowerCase())) return false;
        }
        return true;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-xl font-black">Smart Search</CardTitle>
                        <CardDescription>Search and filter expertise by multidimensional criteria</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => {
                            setQuery('');
                            setDiscipline('All');
                            setMinExp('');
                            setMaxExp('');
                        }}>Clear Filters</Button>
                        <Button variant="outline" onClick={() => {
                            if(filtered.length === 0) return toast.error("No data to export");
                            exportToExcelWithPivots(filtered, 'Smart_Search_Results');
                            toast.success("Excel Report Exported!");
                        }}>Export to Excel</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Search Keywords</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input 
                                    placeholder="Search by name, tags..." 
                                    className="pl-9 h-11 border-slate-200"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Discipline</label>
                            <Select value={discipline} onValueChange={setDiscipline}>
                                <SelectTrigger className="h-11">
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
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Min Exp</label>
                                <Input type="number" placeholder="0" className="h-11" value={minExp} onChange={e => setMinExp(e.target.value)} />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Max Exp</label>
                                <Input type="number" placeholder="99" className="h-11" value={maxExp} onChange={e => setMaxExp(e.target.value)} />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm min-h-[400px]">
                <CardContent className="p-0">
                    {filtered.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-black text-[10px] uppercase tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Name</th>
                                        <th className="px-6 py-4">Discipline</th>
                                        <th className="px-6 py-4">Exp (Yrs)</th>
                                        <th className="px-6 py-4">Specialization</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-bold text-slate-800">{c.candidateName}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant="secondary" className="text-[9px] uppercase">{c.discipline}</Badge>
                                            </td>
                                            <td className="px-6 py-4 font-medium">{c.yearsExp}</td>
                                            <td className="px-6 py-4 text-slate-500 max-w-[200px] truncate">{c.specializedField}</td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-1">
                                                {(c.driveFileUrl || c.fileUrl) && (
                                                    <Button variant="ghost" size="icon" title="Open CV File" onClick={() => window.open(c.driveFileUrl || c.fileUrl, '_blank')}>
                                                        <ExternalLink className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" onClick={() => setSelectedCandidate(c)} title="View Detail">
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                {onDelete && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setConfirmDialog({
                                                                title: 'Are you sure?',
                                                                message: `Move ${c.candidateName} to trash?`,
                                                                onConfirm: () => onDelete(c.id!)
                                                            });
                                                        }}
                                                        title="Delete Candidate"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                            <Search className="w-16 h-16 mb-4 opacity-50" />
                            <p className="font-medium text-slate-400">No candidates found for these criteria.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!selectedCandidate} onOpenChange={() => setSelectedCandidate(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black flex items-center justify-between pr-8">
                            <span>{selectedCandidate?.candidateName}</span>
                            {(selectedCandidate?.driveFileUrl || selectedCandidate?.fileUrl) && (
                                <Button variant="outline" size="sm" onClick={() => window.open(selectedCandidate.driveFileUrl || selectedCandidate.fileUrl, '_blank')} className="gap-2">
                                    <ExternalLink className="w-4 h-4" />
                                    Open CV
                                </Button>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedCandidate && (
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Discipline</p>
                                <p className="font-bold">{selectedCandidate.discipline}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Years Experience</p>
                                <p className="font-bold">{selectedCandidate.yearsExp}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Status</p>
                                <div className="flex items-center gap-2">
                                    <Badge>{selectedCandidate.currentStatus}</Badge>
                                    {onStatusChange && (
                                        <Select 
                                            value={selectedCandidate.currentStatus}
                                            onValueChange={(val) => onStatusChange(selectedCandidate.id, val as CandidateStatus)}
                                        >
                                            <SelectTrigger className="h-8 text-[11px] w-[200px]">
                                                <SelectValue placeholder="Update Status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {['New', 'Screening', 'Interviewing', 'Shortlisted', 'Hired', 'Rejected'].map(s => (
                                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            </div>
                            <div className="col-span-2">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Professional Summary</p>
                                <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                                    {selectedCandidate.professionalSummary || selectedCandidate.rawText?.substring(0, 500) + '...'}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            
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
