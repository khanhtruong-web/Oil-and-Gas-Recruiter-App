import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Database, 
    TrendingUp, 
    CheckCircle2, 
    BarChart3, 
    Clock,
    FileText,
    Layers,
    Calendar,
    FileSpreadsheet,
    Download,
    LogIn
} from 'lucide-react';
import { Candidate, ActivityLog } from '../../types';
import { useAuth } from '../AuthProvider';
import { useDisciplines } from '../../hooks/useDisciplines';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { exportToExcelWithPivots } from '../../lib/excel-export';
import { db } from '../../lib/firebase';
import { getDocs, collection, deleteDoc, doc } from 'firebase/firestore';

export const Dashboard = ({ candidates, activities }: { candidates: Candidate[], activities: ActivityLog[] }) => {
  const { profile } = useAuth();
  const { disciplines: catalogDisciplines } = useDisciplines();

  useEffect(() => {
    // Auto-fix for corrupted old string-based timestamps
    const cleanup = async () => {
      try {
        const snap = await getDocs(collection(db, 'activities'));
        for (const d of snap.docs) {
            const data = d.data();
            if (typeof data.timestamp === 'string' || !data.timestamp) {
                await deleteDoc(doc(db, 'activities', d.id));
                console.log('Cleaned up old string activity');
            }
        }
      } catch(e) {
        console.error("Cleanup failed", e);
      }
    };
    cleanup();
  }, []);

  const [filterDisc, setFilterDisc] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

    const filteredCandidatesFromProps = candidates.filter(c => {
        const cs = c.currentStatus?.toLowerCase() || (c as any).status?.toLowerCase();
        return cs !== 'deleted';
    });

    const filteredCandidates = filteredCandidatesFromProps.filter(c => {
    if (filterDisc && c.discipline !== filterDisc) return false;
    if (filterStatus && c.currentStatus?.toLowerCase() !== filterStatus.toLowerCase()) return false;
    if (filterFrom && c.addedAt && c.addedAt < filterFrom) return false;
    if (filterTo && c.addedAt && c.addedAt > filterTo + 'T23:59:59') return false;
    return true;
  });

  const usedDisciplines = new Set(filteredCandidates.map(c => c.discipline));
  
  const stats = {
    total: filteredCandidates.length,
    disciplines: usedDisciplines.size,
    pending: filteredCandidates.filter(c => c.currentStatus?.toLowerCase() === 'pending_review' || c.currentStatus?.toLowerCase() === 'new' || c.currentStatus?.toLowerCase() === 'reviewed').length,
    approved: filteredCandidates.filter(c => c.currentStatus?.toLowerCase() === 'approved').length,
    newThisMonth: filteredCandidates.filter(c => {
      const d = new Date();
      const mStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      return typeof c.addedAt === 'string' && c.addedAt.startsWith(mStr);
    }).length,
    formatted: filteredCandidates.filter(c => c.cvFormatted || c.exportedWord).length,
  };

  const disciplines = catalogDisciplines.map(d => ({
    name: d,
    value: filteredCandidates.filter(c => c.discipline === d).length
  })).filter(d => d.value > 0).sort((a,b) => b.value - a.value);

  const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#3b82f6'];

  // Line Chart Data
  const trendsData = [];
  for (let i = 6; i >= 0; i--) {
     const d = new Date();
     d.setDate(d.getDate() - i);
     const ds = d.toISOString().slice(0, 10);
     trendsData.push({
         date: ds.slice(5),
         count: filteredCandidates.filter(c => typeof c.addedAt === 'string' && c.addedAt.startsWith(ds)).length
     });
  }

  // Bar Chart Data (Experience)
  const expBins = { '0-5': 0, '5-10': 0, '10-15': 0, '15-20': 0, '20+': 0 };
  filteredCandidates.forEach(c => {
    const y = parseFloat(c.yearsExp?.toString() || '0') || 0;
    if (y <= 5) expBins['0-5']++;
    else if (y <= 10) expBins['5-10']++;
    else if (y <= 15) expBins['10-15']++;
    else if (y <= 20) expBins['15-20']++;
    else expBins['20+']++;
  });
  const expData = Object.keys(expBins).map(k => ({ name: k, Candidates: expBins[k as keyof typeof expBins] }));

  // Pie Chart Data (Status)
  const statusCounts = { New: 0, Reviewed: 0, Approved: 0, Rejected: 0 };
  filteredCandidates.forEach(c => {
      const s = c.currentStatus?.toLowerCase();
      if (s === 'new') statusCounts.New++;
      else if (s === 'reviewed') statusCounts.Reviewed++;
      else if (s === 'approved') statusCounts.Approved++;
      else if (s === 'rejected') statusCounts.Rejected++;
      else statusCounts.New++; // Default mapped
  });
  const statusData = Object.keys(statusCounts).map(k => ({
      name: k,
      value: statusCounts[k as keyof typeof statusCounts]
  })).filter(d => d.value > 0);
  const STATUS_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444'];

  const handleExportDashboard = () => {
    if (filteredCandidates.length === 0) {
      toast.error("No data to export (check filters)");
      return;
    }
    exportToExcelWithPivots(filteredCandidates, 'Dashboard_Analytics');
    toast.success('Dashboard report exported with pivot summaries!');
  };

  const topCandidates = [...filteredCandidates]
    .filter(c => c.aiScore && c.aiScore > 0)
    .sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0))
    .slice(0, 5);

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Just now';
    let d: Date;
    if (ts?.toDate) {
      d = ts.toDate();
    } else if (ts instanceof Date) {
      d = ts;
    } else {
      d = new Date(ts);
    }
    if (isNaN(d.getTime())) return 'Just now';
    
    return d.toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'extract': return <FileText className="w-4 h-4" />;
      case 'status': return <CheckCircle2 className="w-4 h-4" />;
      case 'ai': return <TrendingUp className="w-4 h-4" />;
      case 'export': return <FileSpreadsheet className="w-4 h-4" />;
      case 'delete': return <Database className="w-4 h-4" />;
      case 'login': return <LogIn className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'extract': return 'bg-indigo-500';
      case 'status': return 'bg-emerald-500';
      case 'ai': return 'bg-purple-500';
      case 'export': return 'bg-blue-500';
      case 'delete': return 'bg-rose-500';
      case 'login': return 'bg-blue-600';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-1">Discipline</span>
                  <select 
                      className="h-10 border-none shadow-sm rounded-xl px-3 text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none min-w-[180px] appearance-none cursor-pointer"
                      value={filterDisc} 
                      onChange={(e) => setFilterDisc(e.target.value)}
                  >
                      <option value="">All Disciplines</option>
                      {catalogDisciplines.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
              </div>
              <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-1">Status</span>
                  <select 
                      className="h-10 border-none shadow-sm rounded-xl px-3 text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none w-36 appearance-none cursor-pointer"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                  >
                      <option value="">All Statuses</option>
                      <option value="new">New</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                  </select>
              </div>
              <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-1">Date Range</span>
                  <div className="flex items-center gap-2">
                    <input 
                        type="date"
                        className="h-10 border-none shadow-sm rounded-xl px-3 text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        value={filterFrom}
                        onChange={(e) => setFilterFrom(e.target.value)}
                    />
                    <span className="text-slate-300 font-bold">/</span>
                    <input 
                        type="date"
                        className="h-10 border-none shadow-sm rounded-xl px-3 text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        value={filterTo}
                        onChange={(e) => setFilterTo(e.target.value)}
                    />
                  </div>
              </div>
          </div>
          <Button onClick={handleExportDashboard} className="bg-slate-900 border-none text-white font-bold h-10 px-6 rounded-xl shadow-lg shadow-slate-200 hover:scale-[1.02] transition-transform">
              <Download className="w-4 h-4 mr-2" />
              Download Report
          </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Total CVs', value: stats.total, color: 'text-slate-800', bg: 'bg-slate-900', icon: FileText },
          { label: 'Disciplines', value: stats.disciplines, color: 'text-cyan-600', bg: 'bg-cyan-500', icon: Layers },
          { label: 'Pending', value: stats.pending, color: 'text-amber-500', bg: 'bg-amber-500', icon: Clock },
          { label: 'Approved', value: stats.approved, color: 'text-emerald-500', bg: 'bg-emerald-500', icon: CheckCircle2 },
          { label: 'New/Month', value: stats.newThisMonth, color: 'text-pink-500', bg: 'bg-pink-500', icon: Calendar },
          { label: 'Formatted', value: stats.formatted, color: 'text-blue-500', bg: 'bg-blue-500', icon: FileSpreadsheet },
        ].map((item, i) => (
          <Card key={i} className="border-none shadow-sm shadow-slate-200/50 rounded-2xl overflow-hidden group hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-300">
            <CardContent className="p-5 flex flex-col items-start gap-4">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white transition-transform group-hover:scale-110 duration-300 ${item.bg}`}>
                  <item.icon className="w-5 h-5" />
              </div>
              <div>
                <p className={`text-4xl font-black text-slate-900 leading-none mb-1.5`}>{item.value}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm shadow-slate-200/50 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] font-extrabold flex items-center gap-2 text-slate-900 border-b border-slate-50 pb-4">
                <PieChart className="w-4 h-4 text-indigo-500" />
                Experience Distributions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {disciplines.length > 0 ? (
                <div className="w-full h-[300px] pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={disciplines}
                                innerRadius={75}
                                outerRadius={105}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {disciplines.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <RechartsTooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px' }}
                                itemStyle={{ fontWeight: '800', fontSize: '12px' }}
                            />
                            <Legend verticalAlign="bottom" height={36} wrapperStyle={{fontSize: '11px', fontWeight: 'bold'}} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="w-full h-[300px] flex flex-col items-center justify-center text-slate-300 gap-2">
                    <Layers className="w-10 h-10 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest opacity-50">No data records found</p>
                </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm shadow-slate-200/50 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] font-extrabold flex items-center gap-2 text-slate-900 border-b border-slate-50 pb-4">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Dynamic Upload Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
              <div className="w-full h-[300px] pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendsData} margin={{top: 10, right: 30, left: -10, bottom: 0}}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 800}} axisLine={false} tickLine={false} dy={10} />
                          <YAxis tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 800}} axisLine={false} tickLine={false} allowDecimals={false} />
                          <RechartsTooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px'}} />
                          <Line type="monotone" dataKey="count" name="Submissions" stroke="#6366f1" strokeWidth={4} dot={{r: 5, fill: '#6366f1', strokeWidth: 0}} activeDot={{r: 8, strokeWidth: 4, stroke: '#fff'}} />
                      </LineChart>
                  </ResponsiveContainer>
              </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm shadow-slate-200/50 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] font-extrabold flex items-center gap-2 text-slate-900 border-b border-slate-50 pb-4">
                <BarChart3 className="w-4 h-4 text-cyan-500" />
                Seniority Mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
              <div className="w-full h-[300px] pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={expData} layout="vertical" margin={{top: 0, right: 30, left: 10, bottom: 0}}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" tick={{fontSize: 11, fill: '#475569', fontWeight: 800}} axisLine={false} tickLine={false} width={60} />
                          <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px'}} />
                          <Bar dataKey="Candidates" fill="#06b6d4" radius={[0, 10, 10, 0]} barSize={28} label={{ position: 'right', fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm shadow-slate-200/50 rounded-2xl h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-[13px] font-extrabold flex items-center gap-2 text-slate-900 border-b border-slate-50 pb-4">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Top Candidates (AI Scored)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-4">
                {topCandidates.length > 0 ? topCandidates.map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between group cursor-pointer p-2 hover:bg-slate-50 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs">
                        #{i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 line-clamp-1">{c.candidateName}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c.discipline} • {c.yearsExp} Yrs</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className={`text-sm font-black ${c.aiScore! > 85 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {c.aiScore}%
                      </div>
                      <div className="text-[8px] font-extrabold uppercase text-slate-400">Score</div>
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-10 opacity-30">
                    <TrendingUp className="w-10 h-10 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No candidates scored yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-1 border-none shadow-sm shadow-slate-200/50 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] font-extrabold flex items-center gap-2 text-slate-900 border-b border-slate-50 pb-4">
                <PieChart className="w-4 h-4 text-amber-500" />
                Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={statusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={4}
                              dataKey="value"
                              stroke="none"
                          >
                              {statusData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                              ))}
                          </Pie>
                          <RechartsTooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                          <Legend wrapperStyle={{fontSize: '11px', fontWeight: 'bold'}} />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
            ) : (
                <div className="w-full h-[300px] flex items-center justify-center">
                    <p className="text-slate-300 text-[10px] font-black uppercase tracking-widest italic">Inventory empty</p>
                </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2 border-none shadow-sm shadow-slate-200/50 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px] font-extrabold flex items-center justify-between text-slate-900 border-b border-slate-50 pb-4 w-full">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    Live Activity Feed
                </div>
                <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full animate-pulse border border-emerald-100 shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <span className="text-[9px] uppercase tracking-tighter font-black">Real-time Sync Active</span>
                </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-6 max-h-[450px] overflow-y-auto pr-4 custom-scrollbar">
              {activities && activities.length > 0 ? activities.slice(0, 30).map((act, i) => (
                <div key={act.id || i} className="flex gap-4 relative">
                  {i < activities.length - 1 && (
                    <div className="absolute left-[15px] top-8 bottom-[-24px] w-[2px] bg-slate-50" />
                  )}
                  <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-white ${getActivityColor(act.type)}`}>
                    {getActivityIcon(act.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-black text-slate-800 tracking-tight">{act.userName}</p>
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase">{formatTimestamp(act.timestamp)}</span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-[12px] text-slate-600 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: act.text }} />
                    </div>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-20 opacity-20">
                  <Database className="w-12 h-12 mb-3" />
                  <p className="text-xs font-black uppercase tracking-widest">System logs are empty</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

