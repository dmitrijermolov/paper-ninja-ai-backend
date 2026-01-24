// api/chat2.js  (или api/chat.js)
// Vercel Serverless Function (Node-style req/res)

export const config = {
  api: { bodyParser: true }, // Vercel сам распарсит JSON в req.body
};

function getApiKey() {
  const raw = process.env.OPENAI_API_KEY;
  if (!raw) throw new Error("OPENAI_API_KEY is not set");
  return raw.trim();
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  // Preflight
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  try {
    const apiKey = getApiKey();

    // В Vercel body уже объект (если bodyParser:true)
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) {
      res.statusCode = 400;
      res.end("Bad Request: body.messages must be an array");
      return;
    }

    console.log("➡️ REQUEST MESSAGES:", messages);

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        reasoning: { effort: "low" },
        tools: [{ type: "web_search", search_context_size: "low" }],
        parallel_tool_calls: true,
        text: { verbosity: "low" },
        input: messages,
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      console.error("❌ OPENAI ERROR:", text || upstream.statusText);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: text || upstream.statusText }));
      return;
    }

    // SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      // продублируем CORS на всякий случай
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });

    // В Node fetch() возвращает Web ReadableStream (undici).
    // Читаем через reader и проксируем как есть.
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder("utf-8");

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // value: Uint8Array
        const text = decoder.decode(value, { stream: true });

        console.log("⬇️ RAW CHUNK\n", text);

        // Доп. логирование event/data
        text.split(/\r?\n/).forEach((line) => {
          if (line.startsWith("event:")) {
            console.log("📌 EVENT:", line.slice(6).trim());
          }
          if (line.startsWith("data:")) {
            const payload = line.slice(5).trim();
            if (!payload) return;
            try {
              console.log("🧩 PARSED:", JSON.parse(payload));
            } catch {
              console.log("📦 DATA:", payload);
            }
          }
        });

        // Пишем сырые байты клиенту (важно для SSE)
        res.write(Buffer.from(value));
      }

      console.log("✅ STREAM END");
      res.end();
    } catch (e) {
      console.error("❌ STREAM ERROR", e);
      res.end();
    }

  } catch (e) {
    console.error("❌ SERVER ERROR", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: e?.message || "Internal error" }));
  }
}