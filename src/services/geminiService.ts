import { GoogleGenAI, Type } from "@google/genai";
import { Candidate } from "../types";
import { collection, query, where, getDocs, limit, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

/**
 * Singleton service for Gemini AI operations
 */
class GeminiService {
  private static instance: GeminiService;
  private ai: any;
  private modelName = "gemini-3-flash-preview"; // Recommended model from SKILL.md

  private constructor() {
    this.initClient();
  }

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  public initClient() {
    const key = localStorage.getItem('CUSTOM_GEMINI_KEY') || process.env.GEMINI_API_KEY;
    if (key) {
      this.ai = new GoogleGenAI({ apiKey: key });
    }
  }

  private readonly CV_PARSER_SCHEMA = {
    type: Type.OBJECT,
    properties: {
      candidateName: { type: Type.STRING },
      yearsExp: { type: Type.NUMBER },
      education: { type: Type.STRING },
      discipline: { type: Type.STRING },
      specializedField: { type: Type.STRING },
      workFields: { type: Type.STRING },
      email: { type: Type.STRING },
      phone: { type: Type.STRING },
      currentPosition: { type: Type.STRING },
      certifications: { type: Type.STRING },
      keySkills: { type: Type.STRING },
      aiSummary: { type: Type.STRING },
      aiScore: { type: Type.NUMBER },
      aiStrengths: { type: Type.STRING },
      aiGaps: { type: Type.STRING },
      professionalSummary: { type: Type.STRING }
    },
    required: ["candidateName", "yearsExp", "discipline", "professionalSummary"]
  };

  async parseCV(text: string): Promise<Partial<Candidate>> {
    if (!this.ai) this.initClient();
    if (!this.ai) throw new Error("API Key logic failed: Gemini API key is required.");

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: `Act as a professional recruiter. Extract structured data from this CV text:\n\n${text.substring(0, 30000)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: this.CV_PARSER_SCHEMA,
          temperature: 0.1
        }
      });

      const parsedData = JSON.parse(response.text || "{}");
      
      return {
        ...parsedData,
        rawText: text,
        currentStatus: 'New',
        addedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      } as any;
    } catch (error) {
      console.error("Gemini Parse Error:", error);
      throw error;
    }
  }

  async analyzeCV(text: string, mode: 'spellcheck' | 'review' | 'suggest'): Promise<string> {
    if (!this.ai) this.initClient();
    
    const prompts = {
      spellcheck: "Proofread this CV bio for grammar and spelling. Return standard English corrections.",
      review: "Review this CV for technical depth in Oil & Gas. Provide Strengths, Weaknesses, and Roles.",
      suggest: "Suggest specific content improvements to make this CV more professional for offshore bidding."
    };

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: `${prompts[mode]}\n\nCV TEXT:\n${text}`
      });
      return response.text || "Analysis failed.";
    } catch (error) {
      console.error("Gemini Analysis Error:", error);
      return "Analysis failed due to an AI error.";
    }
  }

  async chatWithData(message: string, history: any[] = [], onChunk?: (text: string) => void) {
    if (!this.ai) this.initClient();

    const tools = [
      {
        functionDeclarations: [
          {
            name: "search_candidates",
            description: "Search the candidate database using filters.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                discipline: { type: Type.STRING },
                minExp: { type: Type.NUMBER },
                name: { type: Type.STRING }
              }
            }
          },
          {
            name: "get_system_stats",
            description: "Get database stats like total count.",
            parameters: { type: Type.OBJECT, properties: {} }
          }
        ]
      }
    ];

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: [
          ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
          { role: "user", parts: [{ text: message }] }
        ],
        config: {
          systemInstruction: `You are a professional HR data assistant for an Oil & Gas recruitment platform. 
          Your goal is to help recruiters find and analyze candidates.
          
          RULES:
          1. Be concise, professional, and helpful.
          2. Do NOT use conversational filler (e.g., "Certainly!", "I've searched the database and found...") before rendering a requested table. Go straight to the data.
          3. If the user asks for statistics, groups, or tables, format your answer using standard Markdown tables.
          4. ALWAYS include a "Grand Total" row at the bottom of any table that lists counts or sums, using the exact text "Grand Total" in the first column (case-insensitive).
          5. Use tools to find candidates. If you use a tool, explain the results clearly after any tables.`,
          tools
        }
      });

      const fc = response.functionCalls?.[0];
      if (fc) {
        if (onChunk) onChunk("Searching database...");
        const toolResult = await this.executeTool(fc.name, fc.args);
        
        const finalResponse = await this.ai.models.generateContent({
          model: this.modelName,
          contents: [
            ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
            { role: "user", parts: [{ text: message }] },
            { role: "model", parts: [{ functionCall: fc }] },
            { role: "user", parts: [{ functionResponse: { name: fc.name, response: toolResult } }] }
          ]
        });

        if (onChunk) onChunk(finalResponse.text || "");
        return finalResponse.text;
      }

      const text = response.text || "";
      if (onChunk) onChunk(text);
      return text;
    } catch (error) {
      console.error("Gemini Chat Error:", error);
      return "I'm sorry, I encountered an error while processing your request.";
    }
  }

  private async executeTool(name: string, args: any) {
    const ref = collection(db, "candidates");
    if (name === "search_candidates") {
      let q = query(ref, limit(10));
      if (args.discipline) q = query(ref, where("discipline", "==", args.discipline), limit(10));
      
      const snap = await getDocs(q);
      let results = snap.docs.map(d => ({ name: d.data().candidateName, discipline: d.data().discipline, exp: d.data().yearsExp }));
      
      if (args.minExp) results = results.filter(r => r.exp >= args.minExp);
      if (args.name) results = results.filter(r => r.name.toLowerCase().includes(args.name.toLowerCase()));
      
      return { candidates: results };
    }
    
    if (name === "get_system_stats") {
      const snap = await getDocs(ref);
      return { totalCandidates: snap.size };
    }
    
    return { error: "Unknown tool" };
  }
}

export const geminiService = GeminiService.getInstance();
