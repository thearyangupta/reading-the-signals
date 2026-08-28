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
4. Human-Readable Prose Citations (NO RAW ENTRY IDs IN PROSE):
   - In user-facing prose fields ('observation', 'explanation', and 'message'), NEVER output raw internal entryId strings (e.g. do NOT write 'In entries y5pz... and C6w...').
   - Reference entries in prose by their human-readable title and/or date (e.g. 'In "Team Standup" and "Sprint Review"...').
   - Raw entryId values are strictly reserved for the 'entryId' property inside 'supportingEntries'.
5. Observational Framing: Describe patterns strictly as observations or recurring tendencies, never as objective facts, personality traits, or psychological conclusions.
6. Zero Diagnosis: NEVER diagnose the user or any other person.
7. No Third-Party Mind-Reading: NEVER infer another person's hidden motives, intentions, beliefs, or internal mental state.
8. No Signal Invention: NEVER invent missing events, emotions, subjects, themes, or interpretations.
9. Insufficient Evidence Transparency: If evidence across the supplied entries is insufficient for a recurring pattern, explicitly state that there is not enough evidence yet.
10. No Artificial Probability/Scoring: Do NOT generate confidence percentages, probability scores, or pseudo-scientific metrics.
11. Grounded Phrasing: Prefer wording such as "Across 3 entries...", "In entries from [date] and [date]...", or "These entries suggest..." rather than absolute claims.
12. Scope Discipline: Do not perform contradiction detection or perspective-evolution/timeline analysis in this phase.`;

export const CROSS_ENTRY_CONTRADICTION_SYSTEM_INSTRUCTION = `You are a careful, compassionate cross-entry perspective and contradiction reasoning assistant for "Reading the Signals".

Your purpose is to compare multiple structured reflection journal entries and surface meaningful differences or contradictions in how the user experienced, reacted to, or interpreted similar situations over time.

WHEN A PERSPECTIVE DIFFERENCE / CONTRADICTION MAY BE SURFACED:
A difference in perspective or reaction may be surfaced ONLY when:
1. At least 2 distinct entries describe sufficiently similar situations, behaviors, themes, or subjects (e.g. receiving work feedback, schedule adjustments, meeting questions);
2. AND the user's own expressed feeling, emotional tone, or stated interpretation differs meaningfully across those entries (e.g., in one entry interpreting questions as constructive interest, and in another interpreting similar questions as criticism).

STRICT MANDATORY DIRECTIVES:
1. Observational Framing (NO ACCUSATORY VERDICTS):
   - NEVER say: "You are inconsistent", "You contradicted yourself", "You are hypocritical", or any accusatory or judgmental verdict.
   - ALWAYS use gentle observational framing such as: "These two entries describe similar situations differently", "A contrast in perspective appears between these reflections", or "Across these situations, your stated interpretation varied."
2. Grounding in User's Stated Experience:
   - Compare ONLY the user's expressed feelings/reactions, emotional tone, stated interpretation, and explicitly described observations.
   - NEVER infer another person's motives, intentions, beliefs, or internal mental state.
   - NEVER diagnose the user or any third party with psychological, clinical, or psychiatric labels.
   - NEVER invent missing interpretations, emotions, or events merely to construct a contradiction.
3. Multi-Entry Evidence Requirement:
   - Every detected difference MUST cite at least 2 distinct supporting journal entries with their exact entryId in supportingEntries.
4. Human-Readable Prose Citations (NO RAW ENTRY IDs IN PROSE):
   - In all user-facing text ('observation', 'explanation', 'clarifyingQuestion', and 'message'), NEVER include raw internal entryId strings.
   - Always reference journal entries in text by their title and/or date (e.g., 'In "Timeline question - neutral one" and "Timeline question - neutral two"...').
   - Keep raw entryId strings strictly inside the 'entryId' property of 'supportingEntries' objects.
5. Conservatism & Ambiguity Handling:
   - If the entries are not sufficiently similar, or if the difference in reaction/interpretation is ambiguous, minor, or unsupported, do NOT flag a contradiction.
   - If evidence is insufficient, explicitly return hasSufficientEvidence: false and an empty contradictions list with a clear, grounded explanation.
6. Exactly One Clarifying Reflection Question:
   - For EACH genuine contradiction/difference, generate EXACTLY ONE targeted, supportive clarifying question.
   - The question must invite thoughtful self-reflection and curiosity rather than judgment or defensiveness.
   - Good example: "These two entries describe similar timeline questions differently — what felt different to you in each situation?"
   - Bad example: "Why are you being inconsistent?"
7. No Pseudo-Scientific Metrics:
   - Do NOT generate confidence percentages, probability scores, or artificial ratings.
8. Scope Discipline:
   - Focus solely on identifying perspective differences and formulating a single supportive clarifying question. Do not build timeline perspectives, scoring, or rating charts.`;

export const SIGNAL_TIMELINE_SYSTEM_INSTRUCTION = `You are a careful, grounded Signal Timeline analysis assistant for "Reading the Signals".

Your purpose is to analyze the authenticated user's dated structured reflection journal entries across time and identify meaningful longitudinal changes in the USER'S explicitly expressed:
- perspective
- emotional reaction or tone
- interpretation
- focus (e.g., shift from focusing on another person's behavior to focusing on the user's own reaction, boundaries, or choices).

STRICT MANDATORY DIRECTIVES FOR SIGNAL TIMELINE REASONING:
1. Strict Grounding in Supplied Dated Entries:
   - Analyze ONLY the structured signals, dates, and explicit text supplied from the user's own journal entries.
   - Never invent missing emotions, interpretations, events, subjects, motives, or perspective changes.
2. Meaningful Temporal Change (NOT A Chronological List):
   - The Signal Timeline is NOT simply a chronological listing of journal entries.
   - A timeline shift/node exists ONLY when the supplied evidence supports a meaningful change in perspective, emotional reaction, interpretation, or focus between earlier and later entries (e.g. hopeful -> anxious, pressured -> calm, external blame -> internal agency/boundaries).
   - Do NOT create a timeline node merely because an entry has a different date.
3. Preserve Chronology & Multi-Entry Support:
   - Every reported shift must identify the specific supporting entries establishing the earlier state ('earlier_state') and later state ('later_state').
   - Earlier and later states MUST be strictly determined from the actual dates of the supplied entries.
   - Every shift must be supported by at least 2 distinct dated entries.
4. Human-Readable Prose Citations (NO RAW ENTRY IDs IN PROSE):
   - In all user-facing text ('observation', 'earlierState', 'laterState', 'explanation', 'message'), NEVER output raw internal entryId strings (e.g. do NOT write 'In entries y5pz... and C6w...').
   - Reference entries in prose strictly by their human-readable title and/or date (e.g. 'In "Sprint Review" (2025-02-10) and "Team Planning" (2025-02-24)...').
   - Raw entryId values are strictly reserved for the 'entryId' property inside 'supportingEntries'.
5. Gentle Observational Language:
   - Use observational language such as:
     * "Across these entries..."
     * "Your reflection appears to shift from..."
     * "In the earlier entry from [date]..."
     * "By the later reflection from [date]..."
   - AVOID absolute or diagnostic language such as:
     * "You realized..."
     * "You always..."
     * "You finally understood..."
     * "This proves..."
     unless the user's own entry explicitly used those exact words.
6. Zero Diagnosis & Zero Third-Party Mind-Reading:
   - NEVER diagnose the user or any other person.
   - NEVER infer another person's hidden motives, intentions, beliefs, emotions, or mental state.
   - Focus exclusively on reflecting the user's own recorded thoughts and stated responses over time.
7. No Pseudo-Scientific Metrics:
   - NEVER generate confidence percentages, probability scores, psychological metrics, or progress ratings.
8. Insufficient Evidence Transparency:
   - If the supplied entries do not provide enough grounded evidence for a genuine change over time, or if reflections are steady without a clear shift, explicitly state that there is not enough evidence yet with hasSufficientEvidence: false and an empty shifts array.`;

/**
 * Defensive prose sanitizer that replaces any raw entry IDs found in text
 * with canonical human-readable titles (and dates).
 */
function sanitizeProseEntryReferences(
  text: string,
  validEntriesMap: Map<string, { entryId: string; title: string; date: string }>
): string {
  if (!text || typeof text !== 'string') return '';
  let sanitized = text;

  // Sort entries by ID length descending to prevent partial substring collisions
  const sortedEntries = Array.from(validEntriesMap.values()).sort(
    (a, b) => b.entryId.length - a.entryId.length
  );

  for (const entry of sortedEntries) {
    if (!entry.entryId || entry.entryId.trim().length < 3) continue;

    const trimmedId = entry.entryId.trim();
    // Escape regex special characters
    const escapedId = trimmedId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match exact entryId
    const regex = new RegExp(`\\b${escapedId}\\b|${escapedId}`, 'g');

    if (regex.test(sanitized)) {
      const canonicalTitle = entry.title && entry.title !== 'Untitled'
        ? `"${entry.title}"`
        : (entry.date ? `entry from ${entry.date}` : 'this entry');

      sanitized = sanitized.replace(regex, canonicalTitle);
    }
  }

  // Clean up double-wrapping of quotes if the model had quotes around the ID like '"entryId"' -> '""Title""'
  sanitized = sanitized.replace(/""([^"]+)""/g, '"$1"');
  // Clean up awkward phrasing like 'In entries "Title" and "Title"' -> 'In "Title" and "Title"'
  sanitized = sanitized.replace(/\bentries\s+(")/gi, '$1');
  sanitized = sanitized.replace(/\bentry\s+(")/gi, '$1');

  return sanitized;
}

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
4. HUMAN-READABLE PROSE ONLY: NEVER include raw entryId strings inside "observation", "explanation", or "message". Reference entries in prose strictly by title (e.g. "Design Review") or date.
5. If there is insufficient evidence for any recurring patterns across these entries, set "hasSufficientEvidence" to false, provide an explanation in "message", and return "patterns" as [].
6. Do NOT include confidence percentages, probability scores, psychoanalysis, or assumptions about third-party motives.`;

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
            'A grounded message summarizing the findings (e.g. "Across 3 entries, 2 recurring observations were identified." or "Not enough evidence yet across the supplied entries to surface recurring patterns."). Must never contain raw entryId strings.',
        },
        patterns: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              observation: {
                type: 'STRING',
                description: 'A concise, grounded observation of a recurring pattern supported by multiple entries. Must never contain raw entryId strings.',
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
                  'A short grounded explanation of how those specific entries demonstrate this observation, citing entry titles instead of raw IDs, without diagnosing or guessing others\' motives.',
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
        const rawObs = String(p?.observation || '').trim();
        const rawExpl = String(p?.explanation || '').trim();

        // Defensively sanitize any raw entryId references out of user-facing prose
        const cleanObservation = sanitizeProseEntryReferences(rawObs, validEntriesMap);
        const cleanExplanation = sanitizeProseEntryReferences(rawExpl, validEntriesMap);

        validatedPatterns.push({
          observation: cleanObservation,
          evidenceCount: validatedSupporting.length, // Never trust Gemini's evidenceCount
          supportingEntries: validatedSupporting,
          explanation: cleanExplanation,
        });
      }
    }

    // If no patterns remain after validation, set hasSufficientEvidence = false
    let hasSufficientEvidence = Boolean(parsedResult?.hasSufficientEvidence) && validatedPatterns.length > 0;
    let rawMessage = typeof parsedResult?.message === 'string' ? parsedResult.message.trim() : '';

    if (validatedPatterns.length === 0) {
      hasSufficientEvidence = false;
      rawMessage = (rawMessage && !parsedResult?.hasSufficientEvidence)
        ? rawMessage
        : 'Not enough recurring evidence across the supplied entries to confirm distinct patterns.';
    }

    const cleanMessage = sanitizeProseEntryReferences(rawMessage, validEntriesMap);

    const sanitizedResult = {
      hasSufficientEvidence,
      message: cleanMessage,
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
 * Endpoint: /api/contradictions
 * Day 6 Cross-Entry Contradiction & Perspective Difference Analysis Endpoint.
 * Analyzes structured journal signals from the authenticated user to detect perspective differences across similar situations.
 */
app.post('/api/contradictions', async (req: Request, res: Response) => {
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
        error: 'At least 2 structured journal entries are required for contradiction analysis.',
        hasSufficientEvidence: false,
        message: 'At least 2 structured journal entries are needed to compare perspectives across similar situations.',
        contradictions: [],
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

    const promptText = `Please analyze the following ${normalizedEntries.length} structured reflection journal entries and surface any genuine perspective differences or contradictions according to your system instructions.

USER ENTRIES DATA:
${formattedEntriesContext}

Task instructions:
1. Surface a perspective difference / contradiction ONLY when at least 2 distinct entries describe sufficiently similar situations, behaviors, themes, or subjects, AND the user's expressed feeling, emotional tone, or stated interpretation differs meaningfully.
2. For each detected difference, cite the exact entryId, title, and date in "supportingEntries" (must contain at least 2 distinct entries).
3. Use gentle observational framing (e.g. "These two entries describe similar situations differently"). NEVER use accusatory words like "inconsistent", "contradicted yourself", or "hypocritical".
4. For EACH detected contradiction, formulate EXACTLY ONE targeted, supportive clarifying question that invites reflection rather than judgment (e.g., "These two entries describe similar timeline inquiries differently — what felt different to you in each situation?").
5. HUMAN-READABLE PROSE ONLY: NEVER include raw entryId strings inside "observation", "explanation", "clarifyingQuestion", or "message". Reference entries in prose strictly by title (e.g. "Timeline question - neutral one") or date.
6. If there is insufficient evidence, entries are not similar enough, or differences are ambiguous, set "hasSufficientEvidence" to false, provide an explanation in "message", and return "contradictions" as [].
7. Do NOT include confidence percentages, probability scores, psychoanalysis, or assumptions about third-party motives.`;

    const contradictionsSchema = {
      type: 'OBJECT',
      properties: {
        hasSufficientEvidence: {
          type: 'BOOLEAN',
          description:
            'True if there is sufficient grounded evidence of at least one meaningful difference/contradiction across at least 2 distinct entries with similar situations/themes; false if evidence is insufficient, ambiguous, or if entries are not sufficiently similar.',
        },
        message: {
          type: 'STRING',
          description:
            'A gentle, grounded message summarizing the findings or explaining why evidence is insufficient. Must never contain raw entryId strings.',
        },
        contradictions: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              observation: {
                type: 'STRING',
                description:
                  'A gentle, non-accusatory observation describing how similar situations were interpreted or experienced differently across entries (e.g. "These two entries describe similar timeline inquiries differently"). Must never contain raw entryId strings.',
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
                description: 'List of specific supporting entries where the perspective difference occurs.',
              },
              explanation: {
                type: 'STRING',
                description:
                  'A short, grounded explanation describing the specific similarities in context and the explicit differences in the user\'s stated feelings, tone, or interpretation, citing human-readable entry titles rather than raw IDs, without guessing others\' motives.',
              },
              clarifyingQuestion: {
                type: 'STRING',
                description:
                  'Exactly ONE targeted, supportive clarifying question inviting the user to explore what felt different in each situation, referencing human-readable entry titles or contexts rather than raw IDs, without judgment or accusation.',
              },
            },
            required: ['observation', 'evidenceCount', 'supportingEntries', 'explanation', 'clarifyingQuestion'],
          },
          description:
            'List of perspective differences / contradictions supported by 2 or more distinct entries. If hasSufficientEvidence is false, this MUST be an empty array [].',
        },
      },
      required: ['hasSufficientEvidence', 'message', 'contradictions'],
    };

    const { text, modelUsed } = await generateWithFallback(
      [
        {
          role: 'user',
          parts: [{ text: promptText }],
        },
      ],
      {
        systemInstruction: CROSS_ENTRY_CONTRADICTION_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: contradictionsSchema,
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
        throw new Error('Failed to parse cross-entry contradiction JSON');
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

    // Validate and de-duplicate supporting entries for each contradiction
    const rawContradictions = Array.isArray(parsedResult?.contradictions) ? parsedResult.contradictions : [];
    const validatedContradictions: {
      observation: string;
      evidenceCount: number;
      supportingEntries: { entryId: string; title: string; date: string }[];
      explanation: string;
      clarifyingQuestion: string;
    }[] = [];

    for (const c of rawContradictions) {
      const rawSupporting = Array.isArray(c?.supportingEntries) ? c.supportingEntries : [];
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

      // Discard any contradiction with fewer than 2 validated supporting entries
      if (validatedSupporting.length >= 2) {
        const rawObs = String(c?.observation || '').trim();
        const rawExpl = String(c?.explanation || '').trim();
        const rawQuestion = String(c?.clarifyingQuestion || '').trim();

        // Defensively sanitize any raw entryId references out of user-facing prose
        const cleanObservation = sanitizeProseEntryReferences(rawObs, validEntriesMap);
        const cleanExplanation = sanitizeProseEntryReferences(rawExpl, validEntriesMap);
        const cleanQuestion = sanitizeProseEntryReferences(rawQuestion, validEntriesMap);

        validatedContradictions.push({
          observation: cleanObservation,
          evidenceCount: validatedSupporting.length, // Never trust Gemini's evidenceCount
          supportingEntries: validatedSupporting,
          explanation: cleanExplanation,
          clarifyingQuestion: cleanQuestion,
        });
      }
    }

    // If no contradictions remain after validation, set hasSufficientEvidence = false
    let hasSufficientEvidence = Boolean(parsedResult?.hasSufficientEvidence) && validatedContradictions.length > 0;
    let rawMessage = typeof parsedResult?.message === 'string' ? parsedResult.message.trim() : '';

    if (validatedContradictions.length === 0) {
      hasSufficientEvidence = false;
      rawMessage = (rawMessage && !parsedResult?.hasSufficientEvidence)
        ? rawMessage
        : 'Not enough grounded evidence across the supplied entries to surface perspective differences.';
    }

    const cleanMessage = sanitizeProseEntryReferences(rawMessage, validEntriesMap);

    const sanitizedResult = {
      hasSufficientEvidence,
      message: cleanMessage,
      contradictions: validatedContradictions,
    };

    res.json({
      result: sanitizedResult,
      modelUsed,
    });
  } catch (error: any) {
    console.error('Error in cross-entry contradiction analysis:', error);
    res.status(500).json({
      error: 'Failed to complete cross-entry contradiction analysis.',
      details: error?.message || 'Internal server error',
    });
  }
});

/**
 * Endpoint: /api/timeline
 * Signal Timeline — Grounded Cross-Entry Perspective Change Reasoning
 */
app.post('/api/timeline', async (req: Request, res: Response) => {
  try {
    const token = await verifyFirebaseToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized. Valid Firebase ID token is required.' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const rawEntries = Array.isArray(body.entries) ? body.entries : [];

    // Map and sanitize incoming entry signals
    const validEntriesMap = new Map<string, { entryId: string; title: string; date: string }>();
    const normalizedEntries: any[] = [];

    for (const entry of rawEntries) {
      if (entry && typeof entry === 'object' && entry.id && typeof entry.id === 'string') {
        const cleanId = String(entry.id).trim();
        const cleanTitle = (typeof entry.title === 'string' && entry.title.trim()) ? entry.title.trim() : 'Untitled Entry';
        const cleanDate = (typeof entry.date === 'string' && entry.date.trim()) ? entry.date.trim() : 'Undated';

        validEntriesMap.set(cleanId, {
          entryId: cleanId,
          title: cleanTitle,
          date: cleanDate,
        });

        normalizedEntries.push({
          id: cleanId,
          date: cleanDate,
          title: cleanTitle,
          situation: String(entry.situation || '').trim(),
          behaviorOrEvent: String(entry.behaviorOrEvent || '').trim(),
          feelingOrReaction: String(entry.feelingOrReaction || '').trim(),
          importantContext: String(entry.importantContext || '').trim(),
          subjects: Array.isArray(entry.subjects) ? entry.subjects : [],
          theme: String(entry.theme || '').trim(),
          emotionalTone: String(entry.emotionalTone || '').trim(),
          interpretation: String(entry.interpretation || '').trim(),
        });
      }
    }

    if (normalizedEntries.length < 2) {
      return res.json({
        result: {
          hasSufficientEvidence: false,
          message: 'At least 2 dated reflection entries are required to analyze changes in perspective over time.',
          shifts: [],
        },
        modelUsed: 'none',
      });
    }

    // Sort chronologically by date ascending
    normalizedEntries.sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      return timeA - timeB;
    });

    const prompt = `Analyze the following chronologically ordered dated reflection journal entries for genuine longitudinal changes in the user's expressed perspective, emotional reaction or tone, interpretation, or focus.

STRICT GROUNDING DIRECTIVES:
1. Identify meaningful longitudinal changes in perspective, emotional reaction, interpretation, or focus over time.
2. DO NOT simply list journal entries chronologically. A timeline node exists ONLY when the supplied evidence supports a genuine shift between earlier and later states.
3. Ground every shift strictly in the supplied text. Never invent missing emotions, interpretations, events, or third-party motives.
4. Never diagnose the user or anyone else. Never generate probability or psychological scores.
5. In all user-facing text fields ('observation', 'earlierState', 'laterState', 'explanation', and 'message'), NEVER use raw internal entryId strings. Refer to entries strictly by their human-readable title and/or date.
6. Reserve raw entryId strings solely for the 'entryId' field inside 'supportingEntries'.
7. For each shift, assign roles to supporting entries ('earlier_state', 'later_state', or 'context') based on actual chronological order.
8. If the entries do not exhibit a clear shift over time, return hasSufficientEvidence: false with an empty shifts list.

Chronologically Ordered Entries:
${JSON.stringify(normalizedEntries, null, 2)}`;

    const timelineSchema = {
      type: 'OBJECT',
      properties: {
        hasSufficientEvidence: { type: 'BOOLEAN' },
        message: { type: 'STRING' },
        shifts: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              shiftType: {
                type: 'STRING',
                enum: ['perspective', 'emotional_reaction', 'interpretation', 'focus'],
              },
              earlierState: { type: 'STRING' },
              laterState: { type: 'STRING' },
              observation: { type: 'STRING' },
              explanation: { type: 'STRING' },
              supportingEntries: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    entryId: { type: 'STRING' },
                    title: { type: 'STRING' },
                    date: { type: 'STRING' },
                    roleInShift: {
                      type: 'STRING',
                      enum: ['earlier_state', 'later_state', 'context'],
                    },
                  },
                  required: ['entryId', 'title', 'date'],
                },
              },
            },
            required: [
              'shiftType',
              'earlierState',
              'laterState',
              'observation',
              'explanation',
              'supportingEntries',
            ],
          },
        },
      },
      required: ['hasSufficientEvidence', 'message', 'shifts'],
    };

    const { text, modelUsed } = await generateWithFallback(prompt, {
      systemInstruction: SIGNAL_TIMELINE_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: timelineSchema,
    });

    let parsedResult: any = null;
    try {
      parsedResult = JSON.parse(text);
    } catch (parseErr) {
      console.error('Failed to parse Gemini timeline response JSON:', parseErr, text);
      return res.status(500).json({
        error: 'Failed to parse AI timeline response.',
        details: text,
      });
    }

    // Deterministic validation & sanitization
    const validatedShifts: any[] = [];

    if (Array.isArray(parsedResult?.shifts)) {
      for (const shift of parsedResult.shifts) {
        if (!shift || typeof shift !== 'object') continue;

        const rawType = String(shift.shiftType || 'perspective').toLowerCase().trim();
        const validShiftTypes = ['perspective', 'emotional_reaction', 'interpretation', 'focus'];
        const shiftType = validShiftTypes.includes(rawType) ? rawType : 'perspective';

        const rawEarlierState = typeof shift.earlierState === 'string' ? shift.earlierState.trim() : '';
        const rawLaterState = typeof shift.laterState === 'string' ? shift.laterState.trim() : '';
        const rawObs = typeof shift.observation === 'string' ? shift.observation.trim() : '';
        const rawExpl = typeof shift.explanation === 'string' ? shift.explanation.trim() : '';

        if (!rawEarlierState || !rawLaterState || !rawObs || !rawExpl) continue;

        const rawSupporting = Array.isArray(shift.supportingEntries) ? shift.supportingEntries : [];
        const validatedSupporting: any[] = [];
        const seenEntryIds = new Set<string>();

        for (const se of rawSupporting) {
          if (!se || typeof se !== 'object' || !se.entryId) continue;
          const entryId = String(se.entryId).trim();
          if (validEntriesMap.has(entryId) && !seenEntryIds.has(entryId)) {
            seenEntryIds.add(entryId);
            const canonical = validEntriesMap.get(entryId)!;
            const rawRole = String(se.roleInShift || '').toLowerCase().trim();
            const roleInShift = ['earlier_state', 'later_state', 'context'].includes(rawRole)
              ? rawRole
              : 'context';

            validatedSupporting.push({
              entryId: canonical.entryId,
              title: canonical.title,
              date: canonical.date,
              roleInShift,
            });
          }
        }

        // Each shift must be supported by at least 2 distinct entries
        if (validatedSupporting.length < 2) continue;

        // Sort supporting entries chronologically
        validatedSupporting.sort((a, b) => {
          const timeA = new Date(a.date).getTime() || 0;
          const timeB = new Date(b.date).getTime() || 0;
          return timeA - timeB;
        });

        const earlierDate = validatedSupporting[0]?.date;
        const laterDate = validatedSupporting[validatedSupporting.length - 1]?.date;

        // Clean prose fields to remove any leaked raw entry IDs
        const cleanEarlierState = sanitizeProseEntryReferences(rawEarlierState, validEntriesMap);
        const cleanLaterState = sanitizeProseEntryReferences(rawLaterState, validEntriesMap);
        const cleanObservation = sanitizeProseEntryReferences(rawObs, validEntriesMap);
        const cleanExplanation = sanitizeProseEntryReferences(rawExpl, validEntriesMap);

        validatedShifts.push({
          shiftType,
          earlierState: cleanEarlierState,
          laterState: cleanLaterState,
          observation: cleanObservation,
          explanation: cleanExplanation,
          evidenceCount: validatedSupporting.length,
          supportingEntries: validatedSupporting,
          earlierDate,
          laterDate,
        });
      }
    }

    let hasSufficientEvidence = Boolean(parsedResult?.hasSufficientEvidence) && validatedShifts.length > 0;
    let rawMessage = typeof parsedResult?.message === 'string' ? parsedResult.message.trim() : '';

    if (validatedShifts.length === 0) {
      hasSufficientEvidence = false;
      rawMessage = (rawMessage && !parsedResult?.hasSufficientEvidence)
        ? rawMessage
        : 'Not enough grounded evidence across the supplied entries to establish a perspective change over time.';
    }

    const cleanMessage = sanitizeProseEntryReferences(rawMessage, validEntriesMap);

    const sanitizedResult = {
      hasSufficientEvidence,
      message: cleanMessage,
      shifts: validatedShifts,
    };

    res.json({
      result: sanitizedResult,
      modelUsed,
    });
  } catch (error: any) {
    console.error('Error in Signal Timeline analysis:', error);
    res.status(500).json({
      error: 'Failed to complete Signal Timeline analysis.',
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
