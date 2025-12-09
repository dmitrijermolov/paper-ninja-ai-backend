
export const runtime = "nodejs";

export default async function handler(req) {

  // ---- CORS ----
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  // ---- Shopify делает OPTIONS перед POST ----
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { message } = await req.json();

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("Backend streaming OK\n"));
        controller.enqueue(encoder.encode("You said: " + message));
        controller.close();
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache"
      }
    });

  } catch (err) {
    return new Response("Error: " + err.message, {
      status: 500,
      headers: corsHeaders
    });
  }
}



/*
// Простейший тестовый backend без OpenAI (работает)

export default async function handler(req, res) {
  // Можно посмотреть, что приходит:
  // console.log("Method:", req.method);
  // console.log("Body:", req.body);

  res.status(200).send("Backend OK (Node function)");
}
*/


/*
// Тоже предварительный рабочий код со стримом

import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Only POST allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const message = body?.message || body?.q;

    if (!message) {
      res.status(400).json({ error: "No message" });
      return;
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // --- Включаем стриминг ---
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages: [{ role: "user", content: message }]
    });

    // --- Настраиваем SSE ---
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const part of completion) {
      const delta = part.choices[0]?.delta?.content || "";
      res.write(delta);
    }

    res.end();
  } catch (err) {
    console.error("ERR:", err);
    res.status(500).json({ error: err.message });
  }
}
*/

