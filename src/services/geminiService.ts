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
      professionalSummary: { type: Type.STRING },
      detailedTasks: { type: Type.STRING, description: "Extract detailed tasks, employment history and projects into a clean readable text format. Use this to hold the full professional records." }
    },
    required: ["candidateName", "yearsExp", "discipline", "professionalSummary"]
  };

  async parseCV(text: string, disciplinesList?: any[]): Promise<Partial<Candidate>> {
    if (!this.ai) await this.initClient();
    if (!this.ai) throw new Error("API Key logic failed: Gemini API key is required.");

    let disciplineInstruction = "For 'discipline', 'specializedField', and 'workFields', you MUST provide the most accurate English technical terms for the Oil & Gas industry.";
    if (disciplinesList && disciplinesList.length > 0) {
      if (typeof disciplinesList[0] === 'string') {
        disciplineInstruction += `\nFor 'discipline', you MUST strictly choose the closest match from this exact list if possible: \n[${disciplinesList.join(", ")}]. If none fit, you may propose a related term.`;
      } else {
        const discStr = disciplinesList.map(d => `- ${d.name}: ${d.description || ''} (Keywords: ${d.keywords?.join(', ') || ''})`).join('\n');
        disciplineInstruction += `\nFor 'discipline', you MUST strictly choose the closest match from this exact list of categories (use exactly the Name):\n${discStr}\nIf completely unrelated, you may propose a different term.`;
      }
    }

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: `Act as a professional recruiter. Extract structured data from this CV text.
The CV may be in English, Vietnamese, or a mix of both. 
${disciplineInstruction}

For 'professionalSummary' (Pitch Summary), generate a comprehensive professional bio in English.

For 'detailedTasks', carefully extract the detailed tabular information from the PDF text. Simplify any complex tables into clear, structured markdown lists (e.g. bullet points for duties, with clear headers for dates/projects). Ensure high accuracy of dates, client names, roles, and project descriptions.

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

  async extractDetailedRecords(text: string): Promise<{ detailedTasks?: string }> {
    if (!this.ai) await this.initClient();
    if (!this.ai) throw new Error("API Key logic failed: Gemini API key is required.");
    
    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: `Carefully extract and beautifully format the ENTIRE Employment Records, Projects Track Record, and Detailed Tasks section from the CV text below. 
You must act like a professional CV writer. Format the output as a clean, highly readable text document. 
Use CAPITALIZED headers for sections like "EMPLOYMENT RECORDS" or "PROJECTS".
Use simple dashes "-" for bullet points.
Ensure every single project, date, and task from the original text is preserved accurately. 
DO NOT RETURN JSON. Just return the beautifully formatted text.

CV TEXT:\n\n${text.substring(0, 30000)}`
      });

      return { detailedTasks: response.text };
    } catch (error) {
      console.error("Gemini Details Extraction Error:", error);
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
For each top candidate, explain why they are a good fit, their Suitability Score against the JD (0-100%), and explicitly list matching and missing certificates.
Crucially, based on their experience and certificates, suggest the BEST matching Discipline for each candidate (even if it differs from what is listed).
Format your response as a professional report with a summary table at the top including ID, Name, Current Discipline, Best Fit Discipline, and Suitability Score.
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
        prompt = `You are an expert Native English Technical Writer and Senior HR Consultant specializing in the Oil & Gas, Offshore, Subsea, and Welding engineering sectors.
Your specific task is to conduct a meticulous line-by-line, word-for-word spellcheck and grammar review of the ENTIRE provided CV.

CRITICAL RULES AND CONSTRAINTS - YOU MUST OBEY THESE:
1. NO OMISSIONS ALLOWED: You MUST proofread, correct, and return EVERY SINGLE SENTENCE, paragraph, bullet point, date, and detail from the original text. Do not summarize. Do not skip any work experience, project, education, or skill. If a section is already perfect, return it exactly as is.
2. MAINTAIN EXACT STRUCTURE AND NEWLINES: Keep the exact structural layout, sections, lists, tables structure, dates, and bullet points of the original CV. VERY IMPORTANT: You MUST preserve every single line break (\\n) from the original text. DO NOT merge separate lines or fields together. If "Project:" is on one line and "Client:" is on the next, they MUST remain on separate lines. DO NOT combine paragraphs into a single block.
3. GRAMMAR AND SPELLING: Correct all spelling mistakes, grammatical errors, typos, awkward phrasing, and non-native sentence structures. Rewrite awkward sentences to read smoothly like a polished, native English professional.
4. PRESERVE TECHNICAL TERMS: Strictly preserve all Oil & Gas and technical engineering terminology (e.g., NDT, QA/QC, ASME, ISO, Subsea, Piping, Structural, Dimensional Control). Do not change technical acronyms, certifications, or industry-standard terms.
5. NO HALLUCINATION: Enhance the impact of action verbs without altering factual meaning, numbers, or adding hallucinated data.
6. PURE OUTPUT: Output the FULL, 100% corrected CV text in beautifully formatted Markdown. DO NOT add any conversational AI filler text before or after the CV. Just return the corrected CV text from start to finish.`;
      } else if (mode === 'review') {
        if (jobDescription) {
          prompt = `Review this CV deeply against the following Job Description. 
1. Provide Strengths and Weaknesses relative to the JD.
2. Provide a Suitability Score (0-100%).
3. Deeply analyze and compare their Certificates vs the JD requirements. Explicitly filter and list "Matching Certificates" and "Missing Certificates".
4. Suggest the BEST matching Discipline for this candidate based on their overall profile and the JD.

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
