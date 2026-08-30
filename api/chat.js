import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful website assistant." },
        { role: "user", content: message }
      ],
    });

    res.status(200).json({
      reply: completion.choices[0].message.content
    });
  } catch (error) {
    res.status(500).json({ error: "Chat failed" });
  }
}
