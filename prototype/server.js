import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || "localhost";
const defaultModel = process.env.OPENAI_DEFAULT_MODEL || "gpt-5";
const apiKey = (process.env.OPENAI_API_KEY || "").trim();
const ai = apiKey ? new OpenAI({ apiKey }) : null;
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174"
]);
const rateBuckets = new Map();

if (!apiKey) {
  console.error("OPENAI_API_KEY is missing in .env. Server will run but AI calls will fail.");
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("CORS origin denied"));
  }
}));
app.use(express.json({ limit: "2mb" }));

function localRateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 60_000;
  const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (bucket.count > 10) return res.status(429).json({ error: "Too many requests" });
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    openaiConfigured: Boolean(ai),
    model: defaultModel,
    message: ai ? "OpenAI is ready." : "Missing OPENAI_API_KEY in .env"
  });
});

app.post("/api/openai", localRateLimit, async (req, res) => {
  try {
    if (!ai) return res.status(500).json({ error: "OpenAI API key is missing." });

    const { prompt, systemInstruction, model } = req.body ?? {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "'prompt' field is required and must be a string." });
    }

    const response = await ai.responses.create({
      model: model || defaultModel,
      input: prompt,
      ...(typeof systemInstruction === "string" ? { instructions: systemInstruction } : {})
    });

    return res.json({ text: response.output_text || "" });
  } catch (err) {
    console.error("OpenAI request failed:", err?.message || err);
    return res.status(err?.status || 500).json({
      error: "OpenAI request failed",
      details: err?.message || "Unknown error"
    });
  }
});

app.post("/api/generate-game", localRateLimit, async (req, res) => {
  try {
    if (!ai) return res.status(500).json({ error: "OpenAI API key is missing." });

    const { prompt, answers, gameType, dimension, systemPrompt } = req.body ?? {};
    if (!prompt) return res.status(400).json({ error: "'prompt' is required." });

    const answersText = answers
      ? Object.entries(answers).map(([key, value]) => `  - ${key}: ${value}`).join("\n")
      : "  (no preferences specified)";

    const userMessage = `
Game description: "${prompt}"

Game type: ${gameType || "auto-detect"}
Dimension: ${dimension || "2D"}

User preferences (from MCQ answers):
${answersText}

Generate the complete game JSON now. Output ONLY valid JSON, no markdown, no explanations.
`.trim();

    const response = await ai.responses.create({
      model: defaultModel,
      input: userMessage,
      ...(typeof systemPrompt === "string" ? { instructions: systemPrompt } : {}),
      text: { format: { type: "json_object" } }
    });

    return res.json({ gameJSON: extractJSON(response.output_text || "") });
  } catch (err) {
    console.error("/api/generate-game failed:", err?.message || err);
    return res.status(500).json({
      error: "Game generation failed",
      details: err?.message || "Unknown error"
    });
  }
});

app.post("/api/edit-game", localRateLimit, async (req, res) => {
  try {
    if (!ai) return res.status(500).json({ error: "OpenAI API key is missing." });

    const { gameJSON, editPrompt, systemPrompt } = req.body ?? {};
    if (!gameJSON || !editPrompt) {
      return res.status(400).json({ error: "'gameJSON' and 'editPrompt' are required." });
    }

    const userMessage = `
You are editing an existing game. Here is the current game JSON:

${JSON.stringify(gameJSON, null, 2)}

Edit request from user: "${editPrompt}"

Instructions:
1. Apply ONLY the requested changes.
2. Keep the same game title and genre.
3. Increment metadata.version when present.
4. Return the COMPLETE modified JSON. Output ONLY valid JSON, no markdown, no explanations.
`.trim();

    const response = await ai.responses.create({
      model: defaultModel,
      input: userMessage,
      ...(typeof systemPrompt === "string" ? { instructions: systemPrompt } : {}),
      text: { format: { type: "json_object" } }
    });

    return res.json({ gameJSON: extractJSON(response.output_text || "") });
  } catch (err) {
    console.error("/api/edit-game failed:", err?.message || err);
    return res.status(500).json({
      error: "Game edit failed",
      details: err?.message || "Unknown error"
    });
  }
});

function extractJSON(text) {
  if (!text) throw new Error("Empty response from OpenAI");

  const cleaned = text
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in OpenAI response");
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (err) {
    throw new Error(`Failed to parse JSON from OpenAI: ${err.message}`);
  }
}

app.listen(port, host, () => {
  console.log("\nGaming Vibe Coding - Prototype Backend");
  console.log(`Running at: http://${host}:${port}`);
  console.log(`OpenAI: ${ai ? "Connected" : "Not configured"}`);
  console.log(`Default model: ${defaultModel}`);
  console.log("\nEndpoints:");
  console.log("  GET  /api/health");
  console.log("  POST /api/openai          (generic)");
  console.log("  POST /api/generate-game   (create new game)");
  console.log("  POST /api/edit-game       (edit existing game)\n");
});
