import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '12mb' }));

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.post('/api/scan-color', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body as {
      imageBase64?: string;
      mimeType?: string;
    };

    if (!imageBase64) {
      res.status(400).json({ error: 'No image data provided.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Scanner AI service is not configured. You can enter or paste the code manually below.',
      });
      return;
    }

    const cleanBase64 = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const imagePart = {
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: cleanBase64,
      },
    };

    const textPart = {
      text:
        'Read all paint shade numbers, colour codes (for example 413, 450, M211, 602, 1708, 205, 123, 8001, 1001), ' +
        'and paint colour names visible on this paint tin, shade card, sticker, barcode label, or handwritten list. ' +
        'Return every detected code and colour name cleanly.',
    };

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts: [imagePart, textPart] },
      config: {
        systemInstruction:
          'You are an optical paint shade code reader for a paint store. Extract exact numeric or alphanumeric shade codes (e.g. 413, M211, 1708, 8001) and shade names. Do not invent codes that are not visible.',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedCodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  code: {
                    type: Type.STRING,
                    description: 'The shade code or number, e.g. 413 or M211 or 8001',
                  },
                  name: {
                    type: Type.STRING,
                    description: 'The shade name if visible, e.g. Golden Brown',
                  },
                  confidence: {
                    type: Type.STRING,
                    description: 'high, medium, or low',
                  },
                },
              },
            },
            rawText: {
              type: Type.STRING,
              description: 'Short summary of any readable label text',
            },
          },
        },
      },
    });

    const rawJson = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawJson);
    res.json({
      detectedCodes: Array.isArray(parsed.detectedCodes) ? parsed.detectedCodes : [],
      rawText: typeof parsed.rawText === 'string' ? parsed.rawText : '',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to scan image';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hafiz server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
