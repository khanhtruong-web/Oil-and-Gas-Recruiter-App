import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Candidate } from '../../types';
import { geminiService } from '../../services/geminiService';
import { toast } from 'sonner';
import { Loader2, Bot, CheckCircle2, Award, TrendingUp } from 'lucide-react';

export const AITools = ({ candidates }: { candidates: Candidate[] }) => {
    const [selectedId, setSelectedId] = useState<string>('');
    const [activeTool, setActiveTool] = useState<'spellcheck' | 'review' | 'suggest'>('spellcheck');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string>('');

    const runAnalysis = async () => {
        if (!selectedId) return toast.error('Please select a CV first');
        const cv = candidates.find(c => c.id === selectedId);
        if (!cv?.rawText) return toast.error('No CV text available for this candidate');
        
        setLoading(true);
        try {
            const res = await geminiService.analyzeCV(cv.rawText, activeTool);
            setResult(res);
        } catch (e) {
            toast.error('AI Analysis failed');
        } finally {
            setLoading(false);
        }
    };

    const tools = [
        { id: 'spellcheck', label: 'Spellcheck', desc: 'AI-powered English grammar & spelling review', icon: CheckCircle2, bg: 'from-blue-500 to-blue-600' },
        { id: 'review', label: 'AI Review', desc: 'Strengths, weaknesses & suitability score', icon: Award, bg: 'from-indigo-500 to-indigo-600' },
        { id: 'suggest', label: 'Suggestions', desc: 'AI-generated CV improvement tips', icon: TrendingUp, bg: 'from-emerald-500 to-emerald-600' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {tools.map(tool => (
                    <Card 
                        key={tool.id}
                        className={`border-2 cursor-pointer transition-all ${activeTool === tool.id ? 'border-primary shadow-md scale-[1.02]' : 'border-transparent shadow-sm'}`}
                        onClick={() => { setActiveTool(tool.id as any); setResult(''); }}
                    >
                        <CardHeader className="text-center pb-2">
                            <div className={`w-14 h-14 mx-auto mb-2 rounded-xl bg-gradient-to-br ${tool.bg} flex items-center justify-center text-white shadow-lg`}>
                                <tool.icon className="w-7 h-7" />
                            </div>
                            <CardTitle className="text-sm font-black">{tool.label}</CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <p className="text-xs text-slate-500 font-medium">{tool.desc}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="border-none shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                <CardHeader>
                    <CardTitle className="text-lg font-black flex items-center gap-2">
                        <Bot className="w-5 h-5 text-primary" />
                        AI Analysis Engine
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <Select value={selectedId} onValueChange={setSelectedId}>
                            <SelectTrigger className="flex-1 h-12 bg-slate-50 border-slate-200 font-medium">
                                <SelectValue placeholder="— Select a candidate's CV —" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {candidates.map(c => (
                                    <SelectItem key={c.id} value={c.id!}>{c.candidateName} - {c.discipline}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button 
                            className="h-12 px-8 font-black tracking-widest uppercase text-[11px]" 
                            onClick={runAnalysis}
                            disabled={loading || !selectedId}
                        >
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
                            Run {tools.find(t => t.id === activeTool)?.label}
                        </Button>
                    </div>

                    <div className="min-h-[300px] bg-slate-50 rounded-xl p-6 border border-slate-100">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full pt-16 text-slate-400 gap-4">
                                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                                <p className="font-bold text-xs uppercase tracking-widest">Scanning Document...</p>
                            </div>
                        ) : result ? (
                            <div className="whitespace-pre-wrap font-medium text-slate-700 text-sm leading-relaxed p-4 bg-white rounded-lg shadow-sm border border-slate-100">
                                {result}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full pt-16 text-slate-300 italic">
                                Select a candidate and click 'Run' to generate insights
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
