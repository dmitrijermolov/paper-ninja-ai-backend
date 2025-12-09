// Старый рабочий

// api/chat.js — Node serverless функция на Vercel

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Вспомогательная функция чтения JSON-тела в Node-формате
async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  let data = typeof req.body === "string" ? req.body : "";

  return await new Promise((resolve, reject) => {
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  // ---- CORS ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
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

  try {
    const body = await readJsonBody(req);
    const userMessage = body?.message || "";

    if (!userMessage) {
      res.statusCode = 400;
      res.end("No message provided");
      return;
    }

    // Заголовки стриминга
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });

    // Можно отправить небольшой префикс (по желанию)
    // res.write("AI помощник по размерам ноутбуков\n\n");

    // Запускаем стрим из OpenAI
    const stream = await client.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        {
          role: "system",
          content: [
            "Ты — ассистент по размерам ноутбуков для магазина чехлов.",
            "Твоя задача: за 1–2 шага уточнить модель (если нужно) и выдать габариты:",
            "ширина, глубина, толщина (в мм).",
            "Если точных данных нет — честно напиши, что не нашёл, и предложи измерить ноутбук линейкой.",
            "Отвечай коротко, по-деловому, на языке пользователя.",
          ].join(" "),
        },
        { role: "user", content: userMessage },
      ],
    });

    // Стримим куски в браузер / Shopify
    for await (const part of stream) {
      const delta = part.choices?.[0]?.delta?.content || "";
      if (delta) {
        res.write(delta);
      }
    }

    res.end();
  } catch (err) {
    console.error("API error:", err);
    // В случае ошибки аккуратно завершаем запрос
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
    res.end("Ошибка сервера. Попробуйте ещё раз.");
  }
}



/*
// Рабочий, но без gpt
// api/chat.js  — Vercel Node Serverless (Form "Other" / Node.js function)

// Можешь эту строку вообще убрать — по умолчанию и так Node
// export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  // ---- CORS ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight от браузера / Shopify
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  // ---- Читаем body ----
  let body = req.body;

  // Если body ещё не распарсен Vercel'ом — читаем вручную
  if (!body || typeof body === "string") {
    body = await new Promise((resolve, reject) => {
      let data = typeof body === "string" ? body : "";
      req.on("data", chunk => (data += chunk));
      req.on("end", () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on("error", reject);
    });
  }

  const message = body?.message || "";

  // ---- Отдаём "стримом" по-Node'овски ----
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
    // даём понять, что будет несколько кусков
    "Transfer-Encoding": "chunked",
  });

  res.write("Backend streaming OK\n");
  res.write("You said: " + message);

  // Обязательно закрываем соединение
  res.end();
}
*/



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

