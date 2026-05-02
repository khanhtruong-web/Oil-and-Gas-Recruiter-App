import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Candidate } from '../types';
import { ScrollArea } from './ui/scroll-area';
import { useAuth } from './AuthProvider';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { geminiService } from '../services/geminiService';

export function ChatBox({ candidates }: { candidates: Candidate[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    const currentMessages = [...messages, { role: 'user' as const, text: userMessage }];
    setMessages(currentMessages);
    setInput('');
    setLoading(true);

    // Create a placeholder AI message
    setMessages(prev => [...prev, { role: 'ai', text: '' }]);

    try {
      // Map history for the service. Filter out the empty AI message we just added
      const history = currentMessages.map(m => ({
        role: m.role,
        content: m.text
      }));

      await geminiService.chatWithData(userMessage, history, (chunkedText) => {
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { role: 'ai', text: chunkedText };
          return newMsgs;
        });
      });
      
    } catch (e: any) {
      console.error(e);
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { role: 'ai', text: `Error: ${e.message}` };
        return newMsgs;
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button 
        onClick={() => setIsOpen(true)}
        size="icon" 
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-xl bg-indigo-600 hover:bg-indigo-700 z-50 transition-transform hover:scale-105"
      >
        <MessageSquare className="w-6 h-6 text-white" />
      </Button>
    );
  }

  return (
    <Card className={`fixed right-6 bottom-6 flex flex-col shadow-2xl border-none ring-1 ring-slate-200 z-50 transition-all duration-300 ${isExpanded ? 'w-[80vw] h-[80vh] max-w-4xl max-h-[800px]' : 'w-[400px] h-[600px] max-h-[80vh] max-w-[90vw]'}`}>
      <CardHeader className="bg-slate-900 text-white rounded-t-xl py-3 px-4 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold">AI Assistant</CardTitle>
            <p className="text-[10px] text-slate-400 font-medium">CV Data Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-800" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-white hover:bg-slate-800" onClick={() => setIsOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden bg-slate-50">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-10 space-y-3">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                    <MessageSquare className="w-6 h-6 text-indigo-600" />
                </div>
                <p className="text-sm text-slate-500 max-w-[250px] mx-auto leading-relaxed">
                  Hi! I now have <b>Deep Search</b> capabilities. Ask me to find candidates with specific experience, search across all disciplines, or give you database-wide statistics.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'}`}>
                  {m.role === 'ai' ? (
                      <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-100 prose-pre:text-slate-800 ai-msg-content">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            tr: ({ children, ...props }) => {
                              // Check if any cell in this row contains "Grand Total" (case-insensitive)
                              const isGrandTotal = React.Children.toArray(children).some((child: any) => {
                                const cellContent = child.props?.children;
                                if (typeof cellContent === 'string') {
                                  return cellContent.toLowerCase().includes('grand total');
                                }
                                if (Array.isArray(cellContent)) {
                                  return cellContent.some(c => typeof c === 'string' && c.toLowerCase().includes('grand total'));
                                }
                                return false;
                              });
                              
                              return <tr {...props} className={isGrandTotal ? 'grand-total-row' : ''}>{children}</tr>;
                            }
                          }}
                        >
                          {m.text}
                        </ReactMarkdown>
                      </div>
                  ) : (
                      <div className="whitespace-pre-wrap">{m.text}</div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  <span className="text-slate-500 font-medium tracking-tight">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
        
        <div className="p-4 bg-white border-t border-slate-200">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2"
          >
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about the CV database..."
              className="flex-1 border-slate-300 focus-visible:ring-indigo-500 rounded-xl"
              disabled={loading}
            />
            <Button type="submit" disabled={!input.trim() || loading} size="icon" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
