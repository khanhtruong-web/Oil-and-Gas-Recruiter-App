import { GoogleGenAI, Type } from "@google/genai";
import { Candidate } from "../types";
import { collection, query, where, getDocs, limit, serverTimestamp, getDoc, doc } from "firebase/firestore";
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

  public async initClient(providedKey?: string) {
    let key = providedKey || process.env.GEMINI_API_KEY;
    if (!key && !this.ai) {
        try {
            const sysDoc = await getDoc(doc(db, 'settings', 'system_config'));
            if (sysDoc.exists() && sysDoc.data().geminiApiKey) {
                key = sysDoc.data().geminiApiKey;
            }
        } catch(e) {
            console.warn("Could not fetch gemini fallback key", e);
        }
    }
    if (key) {
      this.ai = new GoogleGenAI({ apiKey: key });
    }
  }

  public setApiKey(key: string) {
    this.initClient(key);
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
    if (!this.ai) await this.initClient();
    if (!this.ai) throw new Error("API Key logic failed: Gemini API key is required.");

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: `Act as a professional recruiter. Extract structured data from this CV text.
The CV may be in English, Vietnamese, or a mix of both. 
For 'discipline', 'specializedField', and 'workFields', you MUST provide the most accurate English technical terms for the Oil & Gas industry, even if the source is in Vietnamese.
For 'professionalSummary' (Pitch Summary), you MUST generate a comprehensive professional bio in English that explicitly includes:
- A brief overview of their primary expertise/field (what they have the most experience doing).
- Notable certifications (if any).
- Details about their most recent project or role.

CV TEXT:\n\n${text.substring(0, 30000)}`,
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

  async mapCVToTemplate(rawText: string, vars: string[]): Promise<any> {
    if (!this.ai) await this.initClient();
    if (!this.ai) throw new Error("API Key logic failed: Gemini API key is required.");

    const schemaProperties: any = {};
    const required: string[] = [];
    
    vars.forEach(v => {
      schemaProperties[v] = { type: Type.STRING };
      required.push(v);
    });

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: `Extract detailed information from the CV text to fill these specific template variables: ${vars.join(', ')}. 
The CV may be in English or Vietnamese. Please ensure the extracted values are clear and professional. 
For technical variables, favor standard Oil & Gas English terminology if the context is technical.
For any table or list data expected, format it properly as text. If info is missing, output 'N/A'.
CV TEXT:
${rawText.substring(0, 30000)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: schemaProperties,
            required
          },
          temperature: 0.1
        }
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("Gemini Map Template Error:", error);
      throw error;
    }
  }

  async analyzeCV(text: string, mode: 'spellcheck' | 'review' | 'suggest' | 'match', jobDescription?: string, allCandidates?: Candidate[]): Promise<string> {
    if (!this.ai) await this.initClient();
    if (!this.ai) throw new Error("API Key logic failed: Gemini API key is required.");
    
    let prompt = "";
    let contents = "";

    if (mode === 'match' && allCandidates && jobDescription) {
      prompt = `Act as an expert technical recruiter matching CVs against a Job Description.
Please find the best matching candidates for the following Job Description out of the provided list of candidates. 
For each top candidate, explain why they are a good fit, their scores against the JD, and explicitly list matching and missing certificates.
Format your response as a professional report with a summary table at the top including ID, Name, Discipline, and Match Score (0-100%).
Then provide details for each top-ranked candidate.

JOB DESCRIPTION:
${jobDescription.substring(0, 10000)}

CANDIDATES DATA (summarized):
`;
      const candidatesData = allCandidates.map(c => `ID: ${c.id}\nName: ${c.candidateName}\nDiscipline: ${c.discipline}\nExperience: ${c.yearsExp} years\nKey Skills: ${c.keySkills || 'N/A'}\nCertifications: ${c.certifications || 'N/A'}\nProfessional Summary: ${c.professionalSummary || 'N/A'}\n---`).join('\n');
      contents = prompt + candidatesData.substring(0, 20000);
    } else {
      // (rest of the logic remains same for single analyze)
      if (mode === 'spellcheck') {
        prompt = "Proofread this CV bio for grammar and spelling. Return standard English corrections.";
      } else if (mode === 'review') {
        if (jobDescription) {
          prompt = `Review this CV deeply against the following Job Description. 
1. Provide Strengths and Weaknesses relative to the JD.
2. Provide a Suitability Score (0-100%).
3. Deeply analyze and compare their Certificates vs the JD requirements. Explicitly filter and list "Matching Certificates" and "Missing Certificates".

JOB DESCRIPTION:
${jobDescription.substring(0, 10000)}
`;
        } else {
          prompt = `Review this CV for technical depth in Oil & Gas. 
1. Provide Strengths and Weaknesses.
2. Provide a Suitability Score.
3. Explicitly list and filter information related to their Certificates.`;
        }
      } else if (mode === 'suggest') {
        prompt = jobDescription 
          ? `Suggest specific content improvements to make this CV more professional and a better fit for the following Job Description. Provide actionable feedback to enhance the CV's clarity, impact, and keyword optimization.\n\nJOB DESCRIPTION:\n${jobDescription.substring(0, 10000)}`
          : "Suggest specific content improvements to make this CV more professional. Provide actionable feedback on how to enhance the CV's clarity, impact, and keyword optimization for offshore bidding.";
      }
      contents = `${prompt}\n\nCV TEXT:\n${text}`;
    }

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: contents
      });
      return response.text || "Analysis failed.";
    } catch (error) {
      console.error("Gemini Analysis Error:", error);
      return "Analysis failed due to an AI error.";
    }
  }

  async matchCandidatesStructured(jobDescription: string, candidates: Candidate[]): Promise<any> {
    if (!this.ai) await this.initClient();
    if (!this.ai) throw new Error("API Key logic failed: Gemini API key is required.");

    const schema = {
      type: Type.OBJECT,
      properties: {
        matches: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              candidateId: { type: Type.STRING },
              name: { type: Type.STRING },
              score: { type: Type.NUMBER },
              discipline: { type: Type.STRING },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
              matchingCerts: { type: Type.ARRAY, items: { type: Type.STRING } },
              missingCerts: { type: Type.ARRAY, items: { type: Type.STRING } },
              summary: { type: Type.STRING }
            },
            required: ["candidateId", "name", "score", "strengths", "weaknesses", "summary"]
          }
        }
      },
      required: ["matches"]
    };

    const prompt = `Act as an expert technical recruiter. Match the provided candidates against the Job Description.
Return a structured JSON list of the top matches. 
For each candidate, provide a match score (0-100), identify 3-5 key strengths and 2-3 weaknesses relative to the JD.
Also explicitly list matching and missing certifications based on the JD requirements.

JOB DESCRIPTION:
${jobDescription.substring(0, 8000)}

CANDIDATES:
${candidates.map(c => `ID: ${c.id}, Name: ${c.candidateName}, Disc: ${c.discipline}, Exp: ${c.yearsExp}, Skills: ${c.keySkills}, Certs: ${c.certifications}, Summary: ${c.professionalSummary}`).join('\n---\n')}
`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.1
        }
      });

      return JSON.parse(response.text || '{"matches":[]}');
    } catch (error) {
      console.error("Gemini Structured Match Error:", error);
      throw error;
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
