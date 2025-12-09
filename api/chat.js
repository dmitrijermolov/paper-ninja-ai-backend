// api/chat.js
import OpenAI from "openai";

// В edge-runtime
export const runtime = "edge";

export default async function handler(req) {
  // 1) Разрешаем только POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Only POST is allowed" }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Allow": "POST"
        }
      }
    );
  }

  try {
    // 2) Инициализируем клиента OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 3) Безопасно читаем JSON-тело
    let body = {};
    try {
      body = await req.json();
    } catch (e) {
      body = {};
    }

    const message = body.message || body.q || "";

    if (!message) {
      return new Response(
        JSON.stringify({ error: "No message provided" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // 4) Создаём потоковый ответ из OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "Ты помощник по подбору размера чехла для ноутбука. Коротко и по делу: модель, ширина, глубина, толщина."
        },
        { role: "user", content: message }
      ]
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of completion) {
            const text = part.choices[0]?.delta?.content || "";
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache"
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
