import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Candidate } from '../../types';
import { geminiService } from '../../services/geminiService';
import { toast } from 'sonner';
import { Loader2, Bot, CheckCircle2, Award, TrendingUp, Download } from 'lucide-react';
import Markdown from 'react-markdown';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export const AITools = ({ candidates }: { candidates: Candidate[] }) => {
    const [selectedId, setSelectedId] = useState<string>('');
    const [jobDescription, setJobDescription] = useState<string>('');
    const [activeTool, setActiveTool] = useState<'spellcheck' | 'review' | 'suggest'>('spellcheck');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string>('');

    const exportReport = async () => {
        if (!result) return toast.error('No result to export');
        
        try {
            toast.loading('Preparing report...', { id: 'export-report' });
            
            const lines = result.split('\n');
            const children = [];
            
            const toolName = tools.find(t => t.id === activeTool)?.label || 'AI Analysis';
            
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: "CONFIDENTIAL REPORT", bold: true, size: 24, color: "555555" })],
                    spacing: { after: 200 },
                })
            );
            
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: `${toolName} Result`, bold: true, size: 36, color: "000000" })],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { after: 400 },
                })
            );
            
            for (const line of lines) {
                if (!line.trim()) {
                    children.push(new Paragraph({ spacing: { after: 150 } }));
                    continue;
                }
                
                // Keep it simple for markdown handling
                let cleanedLine = line.replace(/^\s*-\s+/, '• '); // List items
                
                if (cleanedLine.startsWith('# ')) {
                    children.push(new Paragraph({ children: [new TextRun({ text: cleanedLine.replace('# ', ''), bold: true, size: 32, color: "111111" })], spacing: { before: 200, after: 100 } }));
                } else if (cleanedLine.startsWith('## ')) {
                    children.push(new Paragraph({ children: [new TextRun({ text: cleanedLine.replace('## ', ''), bold: true, size: 28, color: "222222" })], spacing: { before: 200, after: 100 } }));
                } else if (cleanedLine.startsWith('### ')) {
                    children.push(new Paragraph({ children: [new TextRun({ text: cleanedLine.replace('### ', ''), bold: true, size: 24, color: "333333" })], spacing: { before: 200, after: 100 } }));
                } else {
                    // Try to parse out **bold** text inline
                    const parts = cleanedLine.split(/(\*\*.*?\*\*)/g);
                    const runs = parts.filter(p => !!p).map(part => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return new TextRun({ text: part.replace(/\*\*/g, ''), bold: true, size: 22 });
                        }
                        let cleanText = part.replace(/\*/g, '');
                        return new TextRun({ text: cleanText, size: 22 });
                    });
                    
                    children.push(new Paragraph({ children: runs, spacing: { after: 100 } }));
                }
            }
            
            const doc = new Document({ sections: [{ properties: {}, children }] });
            const blob = await Packer.toBlob(doc);
            
            saveAs(blob, `AI_Report_${toolName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.docx`);
            toast.success('Report exported for managers.', { id: 'export-report' });
        } catch (e) {
            console.error("Export error", e);
            toast.error('Failed to export report.', { id: 'export-report' });
        }
    };

    const runAnalysis = async () => {
        let cv = null;
        
        if (activeTool !== 'suggest' || (activeTool === 'suggest' && !jobDescription)) {
            if (!selectedId) return toast.error('Please select a CV first');
            cv = candidates.find(c => c.id === selectedId);
            if (!cv?.rawText) return toast.error('No CV text available for this candidate');
        }

        if (activeTool === 'suggest' && jobDescription && candidates.length === 0) {
            return toast.error('No candidates available to match against');
        }
        
        setLoading(true);
        try {
            const res = await geminiService.analyzeCV(cv?.rawText || "", activeTool, jobDescription, candidates);
            setResult(res);
        } catch (e) {
            toast.error('AI Analysis failed');
        } finally {
            setLoading(false);
        }
    };

    const tools = [
        { id: 'spellcheck', label: 'Spellcheck', desc: 'AI-powered English grammar & spelling review', icon: CheckCircle2, bg: 'from-blue-500 to-blue-600' },
        { id: 'review', label: 'AI Review', desc: 'Strengths, weaknesses, certs & JD matching', icon: Award, bg: 'from-indigo-500 to-indigo-600' },
        { id: 'suggest', label: 'Candidate Suggestions', desc: 'Find best CVs for a Job Description', icon: TrendingUp, bg: 'from-emerald-500 to-emerald-600' },
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
                    <div className="space-y-2 relative">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Job Description (Optional for deeper matching)</label>
                        <textarea 
                            className="text-sm border border-slate-200 bg-slate-50/50 min-h-[100px] w-full p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2" 
                            placeholder="Paste the Job Description here to match candidates' skills, certifications, and experience against the requirements. Or click the upload icon."
                            value={jobDescription} 
                            onChange={(e) => setJobDescription(e.target.value)} 
                        />
                        <input 
                            type="file" 
                            accept=".pdf,.docx,.doc,.txt" 
                            id="jd-upload" 
                            className="hidden" 
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                    setLoading(true);
                                    let text = '';
                                    if (file.name.endsWith('.pdf')) {
                                        const { extractTextFromPdf } = await import('../../services/pdfService');
                                        text = await extractTextFromPdf(file);
                                    } else if (file.name.endsWith('.docx')) {
                                        const { extractTextFromDocx } = await import('../../services/docxParserService');
                                        text = await extractTextFromDocx(file);
                                    } else if (file.name.endsWith('.doc')) {
                                        const { extractTextFromDoc } = await import('../../services/docxParserService');
                                        text = await extractTextFromDoc(file);
                                    } else if (file.name.endsWith('.txt')) {
                                        text = await file.text();
                                    } else {
                                        toast.error("Unsupported file format.");
                                        return;
                                    }
                                    setJobDescription(text);
                                    toast.success("Job Description loaded.");
                                } catch (err) {
                                    toast.error("Failed to read the file.");
                                } finally {
                                    setLoading(false);
                                }
                            }}
                        />
                        <button 
                            className="absolute bottom-4 right-4 bg-white p-2 rounded-lg shadow-sm border border-slate-200 text-slate-500 hover:text-primary transition-all cursor-pointer"
                            onClick={() => document.getElementById('jd-upload')?.click()}
                            title="Upload Job Description File"
                            type="button"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-upload"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                        </button>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4">
                        {!(activeTool === 'suggest' && jobDescription) && (
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
                        )}
                        <Button 
                            className="h-12 px-8 font-black tracking-widest uppercase text-[11px]" 
                            onClick={runAnalysis}
                            disabled={loading || (!(activeTool === 'suggest' && jobDescription) && !selectedId)}
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
                            <div className="relative group">
                                <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="sm" onClick={exportReport} className="shadow-lg bg-indigo-600 hover:bg-indigo-700 font-bold">
                                        <Download className="w-4 h-4 mr-2" /> Export Word Report
                                    </Button>
                                </div>
                                <div className="prose prose-sm prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-black bg-white rounded-lg shadow-sm border border-slate-100 p-6 md:p-8 relative">
                                    <Markdown>{result}</Markdown>
                                </div>
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
