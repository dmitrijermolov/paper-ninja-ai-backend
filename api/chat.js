import OpenAI from "openai";

export const runtime = "edge";

export default async function handler(req) {
  try {
    const body = await req.json();
    const message = body.message || body.q;

    if (!message) {
      return new Response(JSON.stringify({ error: "No message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Новый рабочий стрим!
    const stream = await openai.chat.completions.stream({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a laptop size assistant." },
        { role: "user", content: message }
      ]
    });

    // Преобразуем поток OpenAI в поток ответа Edge
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      }
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache"
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
