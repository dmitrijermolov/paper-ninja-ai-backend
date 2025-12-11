export const runtime = "nodejs";

// === ПРОКСИ ДЛЯ OpenAI Responses API (GPT-5 + web_search) ===
// === ПОЛНАЯ АДАПТАЦИЯ ТВОЕГО EXPRESS-СЕРВЕРА ===

export default async function handler(req, res) {
  // --- CORS ---
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

  // --- Чтение JSON-тела как в Express ---
  let raw = "";
  await new Promise((resolve) => {
    req.on("data", (c) => (raw += c));
    req.on("end", resolve);
  });

  let messages;
  try {
    messages = JSON.parse(raw)?.messages;
  } catch (e) {
    res.statusCode = 400;
    return res.end("Invalid JSON");
  }

  if (!messages) {
    res.statusCode = 400;
    return res.end("Field 'messages' missing");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    return res.end("Missing OPENAI_API_KEY");
  }

  // --- Готовим SSE-ответ ---
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  try {
    // === Запрос к Responses API с GPT-5 ===
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5",
        stream: true,
        tools: [{ type: "web_search" }],
        input: messages,
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      res.write(`data: ${JSON.stringify({ error: text })}\n\n`);
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    // === ПРОКСИРУЕМ RAW SSE ЧАНКИ ===
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      res.write(chunk); // ← вот это делает магию, как Express
    }

    res.end();
  } catch (err) {
    console.error("Server error:", err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}
