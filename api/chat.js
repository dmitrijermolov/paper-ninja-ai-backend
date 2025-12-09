import OpenAI from "openai";

export const runtime = "edge";

export default async function handler(req) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const body = await req.json();
    const message = body.message || body.q;

    if (!message) {
      return new Response(JSON.stringify({ error: "No message provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ⚡ Новый Streaming API
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: message,
      stream: true
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of response) {
            if (event.output_text) {
              controller.enqueue(encoder.encode(event.output_text));
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
