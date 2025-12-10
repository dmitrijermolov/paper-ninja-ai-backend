export const config = {
  runtime: "edge", // STREAM работает только в EDGE
};

export default async function handler(req) {
  const { message } = await req.json();

  if (!message) {
    return new Response("No message", { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  // Стартуем стрим через fetch к Responses API
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
      input: message,
    }),
  });

  // отдаём поток напрямую клиенту
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
