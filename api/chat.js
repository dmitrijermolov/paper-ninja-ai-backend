import OpenAI from "openai";

export const config = {
  runtime: "edge"
};

export default async function handler(req) {
  try {
    // Создаем клиента OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Читаем текст запроса
    const { message } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "No message provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Создаём потоковый ответ
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "Ты — помощник для подбора размера чехла. Отвечай коротко, технично, строго по теме модели ноутбука."
        },
        { role: "user", content: message }
      ]
    });

    // Превращаем поток OpenAI → поток HTTP
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          for await (const chunk of completion) {
            const text = chunk.choices?.[0]?.delta?.content;
            if (text) controller.enqueue(encoder.encode(text));
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
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
