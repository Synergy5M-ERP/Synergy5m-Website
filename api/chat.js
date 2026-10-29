import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Invalid or empty message provided." });
    }

    if (message.length > 1000) {
      return res.status(400).json({ error: "Message exceeds allowed limit (maximum 1000 characters)." });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful customer service assistant for Synergy 5M." },
        { role: "user", content: message.trim() }
      ],
      max_tokens: 300,
    });

    res.status(200).json({
      reply: completion.choices[0].message.content
    });
  } catch (error) {
    res.status(500).json({ error: "Chat failed" });
  }
}
