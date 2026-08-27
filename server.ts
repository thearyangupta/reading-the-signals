import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

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

// API Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

/**
 * Endpoint: /api/summarize
 * Generates a structured 4-part summary of a reflection journal entry.
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

    const summaryPrompt = `Analyze the user's reflection entry and generate a structured summary object.
Respond ONLY with a valid JSON object containing these exact 4 keys:
1. "situation": Concise summary of the circumstance or setting.
2. "behaviorOrEvent": The specific observable action, event, or interaction that occurred.
3. "feelingOrReaction": The user's expressed emotional response, thought pattern, or reaction.
4. "importantContext": Relevant background details, assumptions, or situational factors noted by the user.

Ensure the summary remains faithful to the user's words without adding psychoanalysis or assumptions about other people's motives.`;

    const summarySchema = {
      type: 'OBJECT',
      properties: {
        situation: { type: 'STRING', description: 'The situation or circumstance described' },
        behaviorOrEvent: { type: 'STRING', description: 'The relevant behavior, event, or incident' },
        feelingOrReaction: { type: 'STRING', description: "The user's expressed feeling or reaction" },
        importantContext: { type: 'STRING', description: 'Important contextual background factors' },
      },
      required: ['situation', 'behaviorOrEvent', 'feelingOrReaction', 'importantContext'],
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
