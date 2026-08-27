import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json';

dotenv.config();

// Initialize Firebase Admin for server-side ID token verification
const adminApp = getApps().length > 0 ? getApps()[0] : initializeApp({
  projectId: firebaseConfig.projectId,
});
const adminAuth = getAuth(adminApp);

/**
 * Verifies Firebase Auth ID Token from request headers
 */
async function verifyFirebaseToken(req: Request): Promise<DecodedIdToken | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return null;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded;
  } catch (error) {
    console.warn('Firebase ID token verification failed:', error);
    return null;
  }
}

const app = express();
const PORT = 3000;

// 1. Top-Level Request Deserialization (Ordering Guarantee)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Lazy Gemini client initialization with defensive error handling
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not defined in environment.');
    }
    aiClient = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return aiClient;
}

// 2. Resilient Model Fallback Ladder
const FALLBACK_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
];

interface FallbackOptions {
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: any;
}

async function generateWithFallback(
  promptOrContents: any,
  options: FallbackOptions = {}
): Promise<{ text: string; modelUsed: string }> {
  const ai = getAiClient();
  let lastError: any = null;

  for (const modelName of FALLBACK_MODELS) {
    try {
      const config: any = {};
      if (options.systemInstruction) {
        config.systemInstruction = options.systemInstruction;
      }
      if (options.responseMimeType) {
        config.responseMimeType = options.responseMimeType;
      }
      if (options.responseSchema) {
        config.responseSchema = options.responseSchema;
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: promptOrContents,
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      if (response && response.text) {
        return { text: response.text, modelUsed: modelName };
      }
    } catch (err: any) {
      console.warn(`[Gemini Fallback] Model ${modelName} failed:`, err?.message || err);
      lastError = err;
      // Continue to next model in the fallback ladder
    }
  }

  throw new Error(`All fallback models failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

const REFLECTION_PARTNER_SYSTEM_INSTRUCTION = `You are a calm, supportive, and non-judgmental reflection partner for a private personal reflection journal named "Reading the Signals".

Your primary objective is to help the user examine their own observations, situations, and feelings with clarity, self-compassion, and deeper self-awareness.

STRICT MANDATORY DIRECTIVES:
1. Do NOT diagnose the user or any third party with psychological or psychiatric conditions.
2. Do NOT make clinical or psychological judgments.
3. Do NOT claim to know another person's hidden intentions, internal thoughts, or unexpressed motives. Instead, help the user separate observable facts/behaviors from their own interpretations or assumed motives.
4. Encourage the user to reflect on what is within their control, how their reactions feel in their body/mind, and what boundaries or values are at play.
5. Ask 1-2 thoughtful, open-ended questions at a time to foster genuine introspection.
6. Tone: Warm, grounded, minimalist, respectful, and calm. Avoid patronizing praise, clinical jargon, or unsolicited life-advice lectures.`;

export const CROSS_ENTRY_REASONING_SYSTEM_INSTRUCTION = `You are a careful, grounded cross-entry reflection analysis assistant for "Reading the Signals".

Your purpose is to analyze multiple structured reflection journal entries and identify potential recurring themes, situations, or reaction patterns across time.

STRICT MANDATORY DIRECTIVES FOR CROSS-ENTRY REASONING:
1. Grounding in Supplied Data: Analyze ONLY the structured signals and explicit text actually supplied from the user's journal entries.
2. Multiple-Entry Evidence Requirement: Identify recurring patterns ONLY when supported by multiple entries (at least 2 distinct entries).
3. Explicit Evidence Citation: Every reported pattern MUST include concrete evidence citing the specific supplied entries, such as dates, titles, situations, or explicit signals.
4. Observational Framing: Describe patterns strictly as observations or recurring tendencies, never as objective facts, personality traits, or psychological conclusions.
5. Zero Diagnosis: NEVER diagnose the user or any other person.
6. No Third-Party Mind-Reading: NEVER infer another person's hidden motives, intentions, beliefs, or internal mental state.
7. No Signal Invention: NEVER invent missing events, emotions, subjects, themes, or interpretations.
8. Insufficient Evidence Transparency: If evidence across the supplied entries is insufficient for a recurring pattern, explicitly state that there is not enough evidence yet.
9. No Artificial Probability/Scoring: Do NOT generate confidence percentages, probability scores, or pseudo-scientific metrics.
10. Grounded Phrasing: Prefer wording such as "Across 3 entries...", "In entries from [date] and [date]...", or "These entries suggest..." rather than absolute claims.
11. Scope Discipline: Do not perform contradiction detection or perspective-evolution/timeline analysis in this phase.`;

// API Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

/**
 * Endpoint: /api/summarize
 * Generates a structured 8-part summary of a reflection journal entry.
 */
app.post('/api/summarize', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { title, content, situation, behaviorOrEvent, feelingOrReaction, importantContext } = body;

    if (!content && !situation && !behaviorOrEvent) {
      return res.status(400).json({ error: 'Journal reflection content or situation details required.' });
    }

    const reflectionText = `
Title: ${title || 'Untitled'}
Content: ${content || ''}
Situation context: ${situation || 'Not specified'}
Behavior or Event: ${behaviorOrEvent || 'Not specified'}
Feeling or Reaction: ${feelingOrReaction || 'Not specified'}
Additional Context: ${importantContext || 'Not specified'}
`.trim();

    const summaryPrompt = `Analyze the user's reflection entry and generate an extended structured summary object.
Respond ONLY with a valid JSON object containing these exact 8 keys:
1. "situation": Concise summary of the circumstance or setting.
2. "behaviorOrEvent": The specific observable action, event, or interaction that occurred.
3. "feelingOrReaction": The user's expressed emotional response, thought pattern, or reaction.
4. "importantContext": Relevant background details, assumptions, or situational factors noted by the user.
5. "subjects": Array of people, roles, objects, places, or recurring entities explicitly supported by the reflection (e.g. ["manager", "project deliverable", "colleague", "conference room"]). If no explicit subjects are supported by the reflection, return []. Do not invent identities or infer hidden motives.
6. "theme": A concise normalized theme that could help compare similar entries later (e.g., "receiving feedback at work", "deadline uncertainty", "conflict with a teammate"). If a meaningful normalized theme cannot be determined without speculation, return "".
7. "emotionalTone": A concise description of the user's expressed tone in this entry, grounded only in what the user wrote. If the emotional tone is not explicitly stated or clearly supported by their words, return "".
8. "interpretation": The meaning or interpretation the USER explicitly or clearly assigns to the situation in their own words. Summarize only the user's stated or clearly expressed interpretation; never infer another person's motives, intentions, beliefs, or internal state; if uncertain, return "".

Conservative Extraction Rules:
- Never invent a value merely to satisfy the schema.
- If no explicit subjects are supported by the user's reflection, return subjects: [].
- If a meaningful normalized theme cannot be determined without speculation, return theme: "".
- If the user's emotional tone is not explicitly stated or clearly supported by their words, return emotionalTone: "".
- If the user does not explicitly or clearly assign a meaning/interpretation to the situation, return interpretation: "".
- For interpretation: summarize only the user's stated or clearly expressed interpretation, never infer another person's motives or internal state, and if uncertain use "".
- For subjects: include only people, roles, objects, places, or recurring entities explicitly supported by the reflection; do not invent identities.
- Ensure the summary remains strictly faithful to the user's explicit words without adding psychoanalysis, diagnostic claims, or speculation.`;

    const summarySchema = {
      type: 'OBJECT',
      properties: {
        situation: { type: 'STRING', description: 'The situation or circumstance described' },
        behaviorOrEvent: { type: 'STRING', description: 'The relevant behavior, event, or incident' },
        feelingOrReaction: { type: 'STRING', description: "The user's expressed feeling or reaction" },
        importantContext: { type: 'STRING', description: 'Important contextual background factors' },
        subjects: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description:
            'People, roles, objects, places, or recurring entities explicitly supported by the reflection. Return an empty array [] if no explicit subjects are supported.',
        },
        theme: {
          type: 'STRING',
          description:
            'A concise normalized theme for future comparison, or an empty string "" if a theme cannot be determined without speculation.',
        },
        emotionalTone: {
          type: 'STRING',
          description:
            "A concise description of the user's expressed tone grounded only in their words, or an empty string \"\" if not explicitly stated or clearly supported.",
        },
        interpretation: {
          type: 'STRING',
          description:
            'The meaning or interpretation the USER explicitly assigns to the situation in their own words (never inferring others\' motives or internal states), or an empty string "" if not explicitly expressed or if uncertain.',
        },
      },
      required: [
        'situation',
        'behaviorOrEvent',
        'feelingOrReaction',
        'importantContext',
        'subjects',
        'theme',
        'emotionalTone',
        'interpretation',
      ],
    };

    const { text, modelUsed } = await generateWithFallback(
      [
        { role: 'user', parts: [{ text: `${summaryPrompt}\n\nENTRY:\n${reflectionText}` }] }
      ],
      {
        systemInstruction: REFLECTION_PARTNER_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: summarySchema,
      }
    );

    let parsedSummary;
    try {
      parsedSummary = JSON.parse(text);
    } catch {
      // Fallback parsing if JSON contains formatting markdown
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedSummary = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse structured summary JSON');
      }
    }

    res.json({
      summary: parsedSummary,
      modelUsed,
    });
  } catch (error: any) {
    console.error('Error generating summary:', error);
    res.status(500).json({
      error: 'Failed to generate structured summary.',
      details: error?.message || 'Internal server error',
    });
  }
});

/**
 * Endpoint: /api/patterns
 * Day 5 Cross-Entry Recurring Pattern Analysis Endpoint.
 * Analyzes only the supplied structured journal signals from the authenticated user.
 */
app.post('/api/patterns', async (req: Request, res: Response) => {
  try {
    // 1. Authenticate caller using Firebase ID token
    const decodedToken = await verifyFirebaseToken(req);
    if (!decodedToken || !decodedToken.uid) {
      return res.status(401).json({
        error: 'Unauthorized: A valid Firebase authentication token is required.',
      });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const rawEntries = Array.isArray(body.entries) ? body.entries : [];

    // Filter and normalize entries with structured signals
    const normalizedEntries = rawEntries
      .filter((e: any) => e && typeof e === 'object' && (e.id || e.title || e.content || e.summary))
      .map((e: any) => ({
        entryId: String(e.id || ''),
        date: String(e.date || ''),
        title: String(e.title || 'Untitled'),
        situation: String(e.summary?.situation || e.situation || ''),
        behaviorOrEvent: String(e.summary?.behaviorOrEvent || e.behaviorOrEvent || ''),
        feelingOrReaction: String(e.summary?.feelingOrReaction || e.feelingOrReaction || ''),
        importantContext: String(e.summary?.importantContext || e.importantContext || ''),
        subjects: Array.isArray(e.summary?.subjects) ? e.summary.subjects : (Array.isArray(e.subjects) ? e.subjects : []),
        theme: String(e.summary?.theme || e.theme || ''),
        emotionalTone: String(e.summary?.emotionalTone || e.emotionalTone || ''),
        interpretation: String(e.summary?.interpretation || e.interpretation || ''),
      }));

    if (normalizedEntries.length < 2) {
      return res.status(400).json({
        error: 'At least 2 structured journal entries are required for cross-entry pattern analysis.',
        hasSufficientEvidence: false,
        message: 'At least 2 structured journal entries are needed to surface recurring observations.',
        patterns: [],
      });
    }

    const formattedEntriesContext = normalizedEntries
      .map((entry: any, index: number) => {
        const subjectsStr = Array.isArray(entry.subjects) && entry.subjects.length > 0
          ? entry.subjects.join(', ')
          : 'None explicitly noted';
        return `
--- ENTRY ${index + 1} ---
Entry ID: ${entry.entryId}
Date: ${entry.date || 'N/A'}
Title: ${entry.title}
Situation: ${entry.situation || 'N/A'}
Behavior or Event: ${entry.behaviorOrEvent || 'N/A'}
Feeling or Reaction: ${entry.feelingOrReaction || 'N/A'}
Important Context: ${entry.importantContext || 'N/A'}
Explicit Subjects: ${subjectsStr}
Normalized Theme: ${entry.theme || 'N/A'}
Emotional Tone: ${entry.emotionalTone || 'N/A'}
Stated Interpretation: ${entry.interpretation || 'N/A'}
--------------------`.trim();
      })
      .join('\n\n');

    const promptText = `Please analyze the following ${normalizedEntries.length} structured reflection journal entries and surface any recurring patterns according to your system instructions.

USER ENTRIES DATA:
${formattedEntriesContext}

Task instructions:
1. Identify recurring patterns ONLY when supported by multiple entries (at least 2 distinct entries).
2. For each pattern, cite the exact entryId, title, and date in "supportingEntries".
3. Provide a concise observation and a grounded explanation based ONLY on what is explicitly written in the supplied entries.
4. If there is insufficient evidence for any recurring patterns across these entries, set "hasSufficientEvidence" to false, provide an explanation in "message", and return "patterns" as [].
5. Do NOT include confidence percentages, probability scores, psychoanalysis, or assumptions about third-party motives.`;

    const patternsSchema = {
      type: 'OBJECT',
      properties: {
        hasSufficientEvidence: {
          type: 'BOOLEAN',
          description:
            'True if there is sufficient evidence across at least 2 distinct entries to support recurring observations; false if evidence is sparse or insufficient.',
        },
        message: {
          type: 'STRING',
          description:
            'A grounded message summarizing the findings (e.g. "Across 3 entries, 2 recurring observations were identified." or "Not enough evidence yet across the supplied entries to surface recurring patterns.")',
        },
        patterns: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              observation: {
                type: 'STRING',
                description: 'A concise, grounded observation of a recurring pattern supported by multiple entries.',
              },
              evidenceCount: {
                type: 'INTEGER',
                description: 'Number of distinct supplied entries supporting this observation (must be >= 2).',
              },
              supportingEntries: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    entryId: { type: 'STRING', description: 'The exact Entry ID' },
                    title: { type: 'STRING', description: 'Title of the entry' },
                    date: { type: 'STRING', description: 'Date of the entry' },
                  },
                  required: ['entryId', 'title', 'date'],
                },
                description: 'List of specific supporting entries.',
              },
              explanation: {
                type: 'STRING',
                description:
                  'A short grounded explanation of how those specific entries demonstrate this observation, without diagnosing or guessing others\' motives.',
              },
            },
            required: ['observation', 'evidenceCount', 'supportingEntries', 'explanation'],
          },
          description:
            'List of recurring patterns supported by 2 or more entries. If hasSufficientEvidence is false, this MUST be an empty array [].',
        },
      },
      required: ['hasSufficientEvidence', 'message', 'patterns'],
    };

    const { text, modelUsed } = await generateWithFallback(
      [
        {
          role: 'user',
          parts: [{ text: promptText }],
        },
      ],
      {
        systemInstruction: CROSS_ENTRY_REASONING_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: patternsSchema,
      }
    );

    let parsedResult;
    try {
      parsedResult = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse cross-entry analysis JSON');
      }
    }

    // 2. SERVER-VERIFY GEMINI EVIDENCE:
    // Build lookup map of valid normalized entries keyed by entryId
    const validEntriesMap = new Map<string, { entryId: string; title: string; date: string }>();
    for (const entry of normalizedEntries) {
      if (entry.entryId) {
        validEntriesMap.set(entry.entryId, {
          entryId: entry.entryId,
          title: entry.title || 'Untitled',
          date: entry.date || '',
        });
      }
    }

    // Validate and de-duplicate supporting entries for each pattern
    const rawPatterns = Array.isArray(parsedResult?.patterns) ? parsedResult.patterns : [];
    const validatedPatterns: {
      observation: string;
      evidenceCount: number;
      supportingEntries: { entryId: string; title: string; date: string }[];
      explanation: string;
    }[] = [];

    for (const p of rawPatterns) {
      const rawSupporting = Array.isArray(p?.supportingEntries) ? p.supportingEntries : [];
      const seenEntryIds = new Set<string>();
      const validatedSupporting: { entryId: string; title: string; date: string }[] = [];

      for (const se of rawSupporting) {
        const rawId = String(se?.entryId || '').trim();
        // Remove every item whose entryId does not exist in normalizedEntries and de-duplicate
        if (rawId && validEntriesMap.has(rawId) && !seenEntryIds.has(rawId)) {
          seenEntryIds.add(rawId);
          const validMeta = validEntriesMap.get(rawId)!;
          // Use verified metadata from normalizedEntries rather than trusting Gemini
          validatedSupporting.push({
            entryId: validMeta.entryId,
            title: validMeta.title,
            date: validMeta.date,
          });
        }
      }

      // Discard any pattern with fewer than 2 validated supporting entries
      if (validatedSupporting.length >= 2) {
        validatedPatterns.push({
          observation: String(p?.observation || '').trim(),
          evidenceCount: validatedSupporting.length, // Never trust Gemini's evidenceCount
          supportingEntries: validatedSupporting,
          explanation: String(p?.explanation || '').trim(),
        });
      }
    }

    // If no patterns remain after validation, set hasSufficientEvidence = false
    let hasSufficientEvidence = Boolean(parsedResult?.hasSufficientEvidence) && validatedPatterns.length > 0;
    let message = typeof parsedResult?.message === 'string' ? parsedResult.message.trim() : '';

    if (validatedPatterns.length === 0) {
      hasSufficientEvidence = false;
      message = (message && !parsedResult?.hasSufficientEvidence)
        ? message
        : 'Not enough recurring evidence across the supplied entries to confirm distinct patterns.';
    }

    const sanitizedResult = {
      hasSufficientEvidence,
      message,
      patterns: validatedPatterns,
    };

    res.json({
      result: sanitizedResult,
      modelUsed,
    });
  } catch (error: any) {
    console.error('Error in cross-entry pattern analysis:', error);
    res.status(500).json({
      error: 'Failed to complete cross-entry pattern analysis.',
      details: error?.message || 'Internal server error',
    });
  }
});

/**
 * Endpoint: /api/reflect
 * Multi-turn reflection conversation partner endpoint.
 */
app.post('/api/reflect', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { entry, history = [], userMessage } = body;

    if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
      return res.status(400).json({ error: 'A valid reflection message is required.' });
    }

    const entryContext = `
[CONTEXT OF JOURNAL ENTRY]
Title: ${entry?.title || 'Untitled'}
Date: ${entry?.date || 'N/A'}
User's Reflection Content:
${entry?.content || 'No text provided.'}

Situation: ${entry?.situation || entry?.summary?.situation || 'N/A'}
Behavior/Event: ${entry?.behaviorOrEvent || entry?.summary?.behaviorOrEvent || 'N/A'}
User Feelings/Reactions: ${entry?.feelingOrReaction || entry?.summary?.feelingOrReaction || 'N/A'}
Context: ${entry?.importantContext || entry?.summary?.importantContext || 'N/A'}
[END OF ENTRY CONTEXT]
`;

    // Construct conversation contents with entry context embedded in the dialogue start
    const contents: any[] = [];

    // First user turn with journal context + starter
    contents.push({
      role: 'user',
      parts: [
        {
          text: `Here is the journal entry I am reflecting on:\n${entryContext}\n\nPlease act as my supportive reflection partner.`
        }
      ]
    });

    contents.push({
      role: 'model',
      parts: [
        {
          text: `Thank you for sharing this reflection. I'm here to explore this with you at your pace. What aspect of this experience would you like to examine more closely?`
        }
      ]
    });

    // Append conversation history
    if (Array.isArray(history)) {
      for (const msg of history) {
        if (msg && msg.content && (msg.role === 'user' || msg.role === 'model')) {
          contents.push({
            role: msg.role,
            parts: [{ text: msg.content }]
          });
        }
      }
    }

    // Append the latest user query
    contents.push({
      role: 'user',
      parts: [{ text: userMessage.trim() }]
    });

    const { text, modelUsed } = await generateWithFallback(contents, {
      systemInstruction: REFLECTION_PARTNER_SYSTEM_INSTRUCTION,
    });

    res.json({
      reply: text.trim(),
      modelUsed,
    });
  } catch (error: any) {
    console.error('Error during reflection turn:', error);
    res.status(500).json({
      error: 'Failed to complete reflection dialogue step.',
      details: error?.message || 'Internal server error',
    });
  }
});

// 3. Vite Middleware integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Reading the Signals server running on http://localhost:${PORT}`);
  });
}

startServer();
