// Простейший тестовый backend без OpenAI

export default async function handler(req, res) {
  // Можно посмотреть, что приходит:
  // console.log("Method:", req.method);
  // console.log("Body:", req.body);

  res.status(200).send("Backend OK (Node function)");
}
