import OpenAI from "openai";

export const runtime = "edge"; // ✔️ Новый корректный синтаксис

export default async function handler(req) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const { message } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "No message provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Создаем потоковый ответ
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",     // ✔️ быстрый и дешёвый
      stream: true,
      messages: [{ role: "user", content: message }]
    });

    const encoder = new TextEncoder();

    // Формируем поток SSE
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of completion) {
            const text = part.choices[0]?.delta?.content || "";
            controller.enqueue(encoder.encode(text));
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache"
      }
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
