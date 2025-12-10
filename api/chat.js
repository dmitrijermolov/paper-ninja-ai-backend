// api/chat.js — Vercel Serverless Function
import OpenAI from "openai";

// --- JSON body reader ---
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
  // CORS
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

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // streaming headers
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    });

    // Responses API stream
    const stream = await client.responses.create({
      model: "gpt-5",
      tools: [{ type: "web_search" }],
      input: userMessage,
      stream: true,
    });

    for await (const item of stream) {
      const delta =
        item?.response?.output_text?.[0]?.content?.[0]?.text || "";
      if (delta) res.write(delta);
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
