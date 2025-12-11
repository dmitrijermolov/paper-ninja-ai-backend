export const runtime = "nodejs";

import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  // CORS
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

  // Чтение JSON
  let body = "";
  await new Promise((resolve) => {
    req.on("data", (chunk) => (body += chunk));
    req.on("end", resolve);
  });

  const { message } = JSON.parse(body || "{}");
  if (!message) {
    res.statusCode = 400;
    res.end("No message provided");
    return;
  }

  // Начинаем стрим НЕМЕДЛЕННО
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    "Transfer-Encoding": "chunked",
    "Access-Control-Allow-Origin": "*"
  });

  // Функция отправки чанков
  const send = (text) => res.write(text);

  // Имитация "поиска"
  const steps = [
    "🔍 Ищу данные в базе производителей...\n",
    "📁 Проверяю технические каталоги...\n",
    "🧠 Сверяю с похожими моделями...\n",
    "📐 Анализирую поколения модели...\n"
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (i < steps.length) {
      send(steps[i]);
      i++;
    } else {
      clearInterval(interval);
    }
  }, 900);

  // Параллельно запрашиваем OpenAI
  let finalAnswer = "Ошибка AI";
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Ты — эксперт по размерам ноутбуков." },
        { role: "user", content: message }
      ]
    });

    finalAnswer = completion.choices[0].message.content;
  } catch (err) {
    finalAnswer = "Ошибка AI: " + err.message;
  }

  // Ждём завершения "анимации"
  await new Promise((resolve) => setTimeout(resolve, 1200));

  send("\n\n✅ Найдено:\n");
  send(finalAnswer);

  res.end();
}
