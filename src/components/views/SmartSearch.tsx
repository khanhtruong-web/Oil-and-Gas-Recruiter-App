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
                        <CardTitle className="text-2xl font-black text-slate-900">Smart Search</CardTitle>
                        <CardDescription className="text-slate-500 font-medium">Search and filter expertise by multidimensional criteria</CardDescription>
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
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1 mb-1 block">Discipline</label>
                            <select 
                                className="h-11 w-full border border-slate-200 shadow-sm rounded-md px-3 text-sm font-medium text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
                                value={discipline} 
                                onChange={(e) => setDiscipline(e.target.value)}
                            >
                                <option value="All">All Disciplines</option>
                                {DISCIPLINE_CATALOG.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
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
                                <thead className="bg-slate-100 text-slate-900 font-black text-xs uppercase tracking-widest border-b-2 border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left">Name</th>
                                        <th className="px-6 py-4 text-left">Discipline</th>
                                        <th className="px-6 py-4 text-center">Exp (Yrs)</th>
                                        <th className="px-6 py-4 text-left">Specialization</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-6 py-4 font-black text-slate-900 text-sm whitespace-nowrap">{c.candidateName}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold uppercase tracking-wider text-[10px] px-2.5 py-1">{c.discipline}</Badge>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center justify-center min-w-[2.5rem] h-7 px-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-black text-xs shadow-sm">
                                                    {c.yearsExp}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 text-xs font-medium max-w-[200px] truncate">{c.specializedField}</td>
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
                <DialogContent className="max-w-[96vw] sm:max-w-[96vw] md:max-w-[96vw] lg:max-w-[96vw] w-full h-[96vh] flex flex-col p-0 overflow-hidden bg-slate-50 border-none sm:rounded-2xl transition-all duration-300">
                    <div className="bg-white border-b border-slate-100 p-4 lg:p-6 flex items-center justify-start pr-16 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg lg:text-xl font-black shadow-lg shadow-indigo-600/20">
                                {selectedCandidate?.candidateName?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                                <DialogTitle className="text-xl lg:text-2xl font-black text-slate-900">{selectedCandidate?.candidateName}</DialogTitle>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2 lg:gap-3">
                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-800 border-indigo-200 font-bold uppercase tracking-wider text-[10px] lg:text-[11px] px-2.5 py-0.5">
                                        {selectedCandidate?.discipline}
                                    </Badge>
                                    <div className="text-xs lg:text-sm font-medium text-slate-500 flex items-center gap-1 border-r border-slate-200 pr-3">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        {selectedCandidate?.currentStatus}
                                    </div>
                                    {(selectedCandidate?.driveFileUrl || selectedCandidate?.fileUrl) && (
                                        <Button size="sm" onClick={() => window.open(selectedCandidate.driveFileUrl || selectedCandidate.fileUrl, '_blank')} className="gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-sm font-bold h-7 ml-1">
                                            <ExternalLink className="w-4 h-4" />
                                            <span className="hidden sm:inline text-xs">Open Original CV</span>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    {selectedCandidate && (
                        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-100/50">
                            {/* Left: Document Preview */}
                            <div className="hidden lg:flex w-[65%] border-r border-slate-200 bg-slate-200 p-2 lg:p-4">
                                {(selectedCandidate.driveFileUrl || selectedCandidate.fileUrl) ? (
                                    <iframe 
                                        src={(selectedCandidate.driveFileUrl || selectedCandidate.fileUrl || '').replace(/\/view.*$/, '/preview')}
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
                                        <p className="font-bold text-slate-700 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg inline-block">{selectedCandidate.yearsExp} Years</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">AI Score</p>
                                        {selectedCandidate.aiScore ? (
                                            <p className="font-black text-indigo-600 text-lg px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg inline-block">{selectedCandidate.aiScore}/100</p>
                                        ) : (
                                            <p className="font-black text-slate-400 text-sm px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg inline-block">N/A</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5">Update Status</p>
                                    {onStatusChange ? (
                                        <div className="pt-1">
                                            <Select 
                                                value={selectedCandidate.currentStatus}
                                                onValueChange={(val) => onStatusChange(selectedCandidate.id!, val as CandidateStatus)}
                                            >
                                                <SelectTrigger className="h-10 text-xs w-full font-bold bg-slate-50 border-slate-200">
                                                    <SelectValue placeholder="Update Status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {['New', 'Reviewing', 'Shortlisted', 'Hired', 'Rejected'].map(s => (
                                                        <SelectItem key={s} value={s} className="font-medium">{s}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : (
                                        <Badge className="bg-slate-800">{selectedCandidate.currentStatus}</Badge>
                                    )}
                                </div>

                                {(selectedCandidate.email || selectedCandidate.phone) && (
                                    <div className="space-y-3 pt-2">
                                        {selectedCandidate.email && (
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Email</p>
                                                <p className="font-bold text-sm text-blue-600 truncate">{selectedCandidate.email}</p>
                                            </div>
                                        )}
                                        {selectedCandidate.phone && (
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Phone</p>
                                                <p className="font-bold text-sm text-slate-700">{selectedCandidate.phone}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                <hr className="border-slate-100 my-4" />

                                {selectedCandidate.professionalSummary && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Summary</p>
                                        <p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                                            {selectedCandidate.professionalSummary}
                                        </p>
                                    </div>
                                )}

                                {selectedCandidate.keySkills && (
                                    <div className="space-y-2 pt-2">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Key Skills</p>
                                        <p className="text-sm font-semibold text-slate-700 whitespace-pre-wrap">
                                            {selectedCandidate.keySkills}
                                        </p>
                                    </div>
                                )}

                                {(selectedCandidate.education || selectedCandidate.certifications) && (
                                    <div className="space-y-5 pt-2">
                                        {selectedCandidate.education && (
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Education</p>
                                                <p className="text-xs font-medium text-slate-600">{selectedCandidate.education}</p>
                                            </div>
                                        )}
                                        {selectedCandidate.certifications && (
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Certifications</p>
                                                <p className="text-xs font-medium text-slate-600">{selectedCandidate.certifications}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
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
