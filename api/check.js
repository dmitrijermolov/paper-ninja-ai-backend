export const config = { runtime: "nodejs" };

import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const hasResponses = typeof client.responses?.stream === "function";
    
    res.status(200).json({
      sdk_version: OpenAI.version || "unknown",
      has_responses_api: hasResponses,
      available_models_hint:
        "Если has_responses_api=true — GPT-5 и web_search будут работать."
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
