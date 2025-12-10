// api/chat.js — Node.js Serverless Function on Vercel
import OpenAI from "openai";

export const config = {
  runtime: "nodejs",  // важно для работы потоков
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Утилита чтения JSON-тела (нужно для Node serverless) ---
async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;

  let data = "";
  return await new Promise((resolve, reject) => {
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  // ---- CORS ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }

  try {
    const body = await readJson(req);
    const userMessage = body?.message || "";

    if (!userMessage) {
      res.statusCode = 400;
      return res.end("No message");
    }

    // --- Настройка ответа для стриминга ---
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    });

    // --- Запрос в Responses API ---
    const response = await client.responses.create({
      model: "gpt-5", // можно заменить на gpt-5-preview
      tools: [{ type: "web_search" }],
      input: userMessage,
      stream: true,
    });

    // --- Чтение stream-дельт ---
    for await (const event of response) {
      // Каждый event может содержать delta text
      const textDelta =
        event?.response?.output_text?.[0]?.content?.[0]?.text || "";

      if (textDelta) {
        res.write(textDelta);
      }
    }

    res.end();
  } catch (err) {
    console.error("SERVER ERROR:", err);

    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain");
    }

    res.end("Server error");
  }
}
