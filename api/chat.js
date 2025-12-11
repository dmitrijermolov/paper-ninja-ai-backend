export const runtime = "nodejs";

// === GPT-5 через Responses API (правильный современный способ) ===

export default async function handler(req, res) {
  // ----- CORS -----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

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

  // ----- читаем тело -----
  let body = "";
  await new Promise((resolve) => {
    req.on("data", (c) => (body += c));
    req.on("end", resolve);
  });

  let msg = "";
  try {
    msg = JSON.parse(body)?.message || "";
  } catch (e) {
    res.statusCode = 400;
    res.end("Invalid JSON");
    return;
  }

  if (!msg) {
    res.statusCode = 400;
    res.end("No message provided");
    return;
  }

  // ----- ответ начинаем сразу (streaming) -----
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    "Transfer-Encoding": "chunked",
    "Access-Control-Allow-Origin": "*",
  });

  // ===== SYSTEM PROMPT =====
  const SYSTEM = `
Ты — эксперт по точным размерам ноутбуков.

СТРОГИЕ ПРАВИЛА:
1. Давай ТОЛЬКО точные размеры в мм: ширина, глубина, толщина.
2. Если точной информации НЕТ — отвечай: "Нет точных данных по этой модели."
3. Запрещено:
   • выдумывать,
   • давать диапазоны,
   • писать «обычно», «примерно», «может варьироваться»,
   • описывать ноутбук.
4. Ответ — только факты. Никакой лишней воды.
`;

  // ===== создаём запрос к Responses API =====

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5",
      stream: true,
      tools: [{ type: "web_search" }],   // даём доступ к поиску
      input: [
        { role: "system", content: SYSTEM },
        { role: "user", content: msg },
      ],
    }),
  });

  // Если ошибка API — отдаём текст ошибки
  if (!upstream.ok) {
    const errText = await upstream.text();
    res.write("Ошибка сервера OpenAI:\n" + errText);
    return res.end();
  }

  // ===== ПРОКСИРУЕМ ПОТОК НАПРЯМУЮ В SHOPIFY =====

  try {
    for await (const chunk of upstream.body) {
      const text = chunk.toString("utf8");

      // ФИЛЬТРЫ АНТИ-ХАЛЛЮЦИНАЦИЙ
      if (/обычно|примерно|варьирует|around|typically/i.test(text)) {
        // НЕ выводим такие куски в ответ
        continue;
      }

      // Пишем чисто то, что сказал GPT-5
      res.write(text);
    }
  } catch (err) {
    res.write("\nОшибка стриминга: " + err.message);
  }

  res.end();
}
