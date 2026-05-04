import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
    Database, 
    Bot, 
    Award, 
    FileSearch, 
    BarChart3,
    Download
} from 'lucide-react';
import { Candidate } from '../../types';
import { useDisciplines } from '../../hooks/useDisciplines';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
import { exportToExcelWithPivots } from '../../lib/excel-export';

export const ReportsView = ({ candidates }: { candidates: Candidate[] }) => {
    const { disciplines: catalogDisciplines } = useDisciplines();

    const pipelineData = [
        { name: 'New', count: candidates.filter(c => c.currentStatus === 'New').length },
        { name: 'Reviewing', count: candidates.filter(c => c.currentStatus === 'Reviewing').length },
        { name: 'Shortlisted', count: candidates.filter(c => c.currentStatus === 'Shortlisted').length },
        { name: 'Hired', count: candidates.filter(c => c.currentStatus === 'Hired').length },
        { name: 'Rejected', count: candidates.filter(c => c.currentStatus === 'Rejected').length },
    ];

    const disciplineData = catalogDisciplines.map(d => {
        const list = candidates.filter(c => c.discipline === d);
        if (list.length === 0) return null;
        const avgExp = (list.reduce((acc, c) => acc + (c.yearsExp || 0), 0) / list.length).toFixed(1);
        return { discipline: d, count: list.length, avgExp: parseFloat(avgExp) };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    const avgAiRating = candidates.length > 0 
        ? Math.round(candidates.reduce((acc, c) => acc + (c.aiScore || 0), 0) / candidates.length)
        : 0;

    const handleExportExcel = () => {
        if (candidates.length === 0) {
            toast.error("No data to export");
            return;
        }

        exportToExcelWithPivots(candidates, 'CV_Reports');
        toast.success("Excel Report with pivots exported!");
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
             <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-primary" /> Reports & Analytics
                    </h2>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">Aggregated system intelligence</p>
                </div>
                <Button onClick={handleExportExcel} className="font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
                    <Download className="w-4 h-4 mr-2" />
                    Export Complete Report (.xlsx)
                </Button>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Talent Pool', value: candidates.length, icon: Database, color: 'text-blue-600' },
                    { label: 'Avg AI Rating', value: `${avgAiRating}%`, icon: Bot, color: 'text-indigo-600' },
                    { label: 'Active Placement', value: candidates.filter(c => c.currentStatus === 'Hired').length, icon: Award, color: 'text-emerald-600' },
                    { label: 'Review Pipeline', value: candidates.filter(c => c.currentStatus === 'Reviewing').length, icon: FileSearch, color: 'text-amber-600' },
                ].map((item, i) => (
                    <Card key={i} className="border-none shadow-sm h-full">
                        <CardHeader className="pb-2">
                           <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center justify-between">
                               {item.label}
                               <item.icon className={`h-4 w-4 ${item.color} opacity-40`} />
                           </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-black ${item.color} tabular-nums`}>{item.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-black flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-primary" />
                            Status Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={pipelineData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-black flex items-center gap-2">
                            <Database className="w-5 h-5 text-emerald-500" />
                            Strategic Discipline Analytics
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px] overflow-y-auto pr-2">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-slate-100">
                                    <TableHead className="font-black text-[10px] uppercase text-slate-400 tracking-widest pl-6">Sector Discipline</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase text-slate-400 tracking-widest">Density</TableHead>
                                    <TableHead className="font-black text-[10px] uppercase text-slate-400 tracking-widest text-right pr-6">Mean Tenure</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {catalogDisciplines.map(d => {
                                    const list = candidates.filter(c => c.discipline === d);
                                    if (list.length === 0) return null;
                                    const avgExp = (list.reduce((acc, c) => acc + (c.yearsExp || 0), 0) / list.length).toFixed(1);
                                    return (
                                        <TableRow key={d} className="border-slate-50 hover:bg-slate-50/30 transition-all">
                                            <TableCell className="font-bold text-slate-800 pl-6 text-sm">
                                                <div className="truncate max-w-[150px]" title={d}>{d}</div>
                                            </TableCell>
                                            <TableCell className="font-black text-slate-600 tabular-nums">
                                                <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
                                            </TableCell>
                                            <TableCell className="font-medium text-slate-500 tabular-nums font-mono text-xs text-right pr-6">{avgExp} Yrs</TableCell>
                                        </TableRow>
                                    );
                                }).filter(x => x !== null)}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
