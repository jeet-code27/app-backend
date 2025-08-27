require("dotenv").config();
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Main chat controller
const chatWithAssistant = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.json({ reply: "Please type a message to chat with Ananya." });
    }

    // Try GPT first
    let reply = await callGptModel(message);

    // Fallback to Gemini if GPT fails
    if (!reply || !reply.trim()) {
      reply = await callGeminiFlash(message);
    }

    res.json({ reply: reply.trim() });
  } catch (err) {
    console.error("❌ Chat Assistant Error:", err);
    res.status(500).json({ error: "Chat Assistant failed." });
  }
};

// OpenAI GPT call
async function callGptModel(userMessage) {
  if (!process.env.OPENAI_API_KEY) return "";

  try {
    const prompt = `
You are Ananya, a friendly, professional assistant for SEOcial Media Solutions 💻✨.
Speak like a real human: warm, clear, and conversational. Keep replies short.

User message: ${userMessage}
`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (err) {
    console.error("❌ GPT Error:", err.message);
    return "";
  }
}

// Gemini Flash call
async function callGeminiFlash(userMessage) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
You are Ananya, the friendly and professional assistant for SEOcial Media Solutions 💻✨.
Speak naturally and clearly. Keep replies short.

User message: ${userMessage}
`;

    const result = await model.generateContent(prompt);
    return result.response?.text() || "";
  } catch (err) {
    console.error("❌ Gemini Flash Error:", err.message);
    return "Sorry! Something went wrong. Please try again.";
  }
}

module.exports = { chatWithAssistant };
