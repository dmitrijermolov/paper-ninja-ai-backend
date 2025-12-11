export const runtime = "nodejs";

export default async function handler(req, res) {
  // ---- CORS ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  // ---- Reading body ----
  let body = "";
  await new Promise((resolve) => {
    req.on("data", (chunk) => (body += chunk));
    req.on("end", resolve);
  });

  let message = "";
  try {
    message = JSON.parse(body)?.message || "";
  } catch (e) {
    res.statusCode = 400;
    return res.end("Invalid JSON");
  }

  if (!message) {
    res.statusCode = 400;
    return res.end("No message provided");
  }

  // ---- STREAM RESPONSE ----
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    "Transfer-Encoding": "chunked",
    "Access-Control-Allow-Origin": "*",
  });

  // ---- SYSTEM PROMPT ----
  const SYSTEM = `
Ты — эксперт по размерам ноутбуков.
Давай ТОЛЬКО точные размеры в мм.
Если точных данных нет — напиши: "Нет точных данных по этой модели."
Запрещено: "обычно", "примерно", "может варьироваться", диапазоны, выдумки.
Только факты.
`;

  // ---- REQUEST TO RESPONSES API ----
  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5",
      stream: true,
      tools: [{ type: "web_search" }],
      input: [
        { role: "system", content: SYSTEM },
        { role: "user", content: message }
      ]
    }),
  });

  const decoder = new TextDecoder();

  try {
    for await (const chunk of upstream.body) {
      const text = decoder.decode(chunk);

      // SSE содержит отдельные события: ищем "output_text"
      const lines = text.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;

        let data;
        try {
          data = JSON.parse(line.replace("data:", "").trim());
        } catch {
          continue;
        }

        // Ищем текстовый вывод
        const output = data?.delta?.output_text;
        if (output) {
          res.write(output);
        }
      }
    }
  } catch (err) {
    res.write("\n[Stream error]\n" + err.message);
  }

  res.end();
}
