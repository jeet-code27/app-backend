require("dotenv").config();
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ======================
// Session store with 15-minute memory
// ======================
const sessions = {};
const SESSION_TTL = 15 * 60 * 1000; // 15 minutes

function getSession(sessionId) {
  if (!sessionId) return null;

  const now = Date.now();
  if (!sessions[sessionId]) {
    sessions[sessionId] = { messages: [], lastActive: now };
  } else if (now - sessions[sessionId].lastActive > SESSION_TTL) {
    // Session expired
    sessions[sessionId] = { messages: [], lastActive: now };
  }
  sessions[sessionId].lastActive = now;
  return sessions[sessionId];
}

// ======================
// Chat controller
// ======================
const chatWithAssistant = async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !message.trim())
      return res.json({ reply: "Please type a message to chat with Ananya." });

    if (!sessionId)
      return res.status(400).json({ error: "Session ID is required" });

    const session = getSession(sessionId);

    // Save user message
    session.messages.push({
      role: "user",
      content: message.trim(),
    });

    // Build previousMessages string for prompt
    const previousMessages = session.messages
      .map((m) => `${m.role === "user" ? "User" : "Ananya"}: ${m.content}`)
      .join("\n");

    // 1️⃣ Try local responses first
    let botText = getLocalResponse(message);

    // 2️⃣ Fallback to GPT/Gemini if local response is null
    if (!botText) botText = await callGptModel(message, previousMessages);
    if (!botText || !botText.trim())
      botText = await callGeminiFlash(message, previousMessages);

    // Save AI response to session
    session.messages.push({
      role: "assistant",
      content: botText.trim(),
    });

    res.json({ reply: botText.trim() });
  } catch (err) {
    console.error("❌ Chat Assistant Error:", err);
    res.status(500).json({ error: "Chat Assistant failed." });
  }
};

// ======================
// Local fallback responses
// ======================
function getLocalResponse(text) {
  const t = text.toLowerCase();
  if (/(hello|hi|hey)/.test(t))
    return "👋 Welcome to SEOcial Media Solutions! How can I assist you today?";
  if (/(help|services|offer)/.test(t))
    return "We offer SEO, Web/App Development, Content & Video services. Which one interests you?";
  if (/(seo|search engine optimization)/.test(t))
    return "🔍 Our SEO services include On-Page, Off-Page, Technical, Local, Ecommerce, and International SEO 🌍.";
  if (/(front-end|frontend|ui|ux)/.test(t))
    return "🎨 Front-End: Modern, responsive interfaces with React, Next.js, Tailwind CSS.";
  if (/(back-end|backend|server|api|database)/.test(t))
    return "🖥️ Back-End: APIs, server logic, databases, authentication, scalable solutions.";
  if (/(full-stack|complete web app)/.test(t))
    return "💡 Full-Stack: Complete web & mobile solutions end-to-end.";
  if (/(app|mobile|android|ios)/.test(t))
    return "📱 Mobile App Development: Android & iOS apps tailored for your business.";
  if (/(blog|content|writing)/.test(t))
    return "📝 Content & Blogs: Articles, social media posts, email campaigns, creative strategies.";
  if (/(video|animation|media)/.test(t))
    return "🎬 Video & Animation: Corporate, promo, social media, explainer videos.";
  if (/(contact|reach|email|phone)/.test(t))
    return "📞 Reach us at contact@seocialmedia.com or +91-9876543210.";
  if (/(time)/.test(t))
    return `⏰ Current time: ${new Date().toLocaleTimeString()}`;
  if (/(date|today)/.test(t))
    return `📅 Today is ${new Date().toLocaleDateString()}`;
  if (/(thanks|thank you)/.test(t))
    return "🙏 You're welcome! Happy to help 😊";
  if (/(bye|goodbye)/.test(t)) return "👋 Goodbye! Have a great day ahead.";
  return null; // No local match
}

// ======================
// OpenAI GPT call
// ======================
async function callGptModel(userMessage, previousMessages) {
  if (!process.env.OPENAI_API_KEY) return "";

  const prompt = `You are Ananya, the professional, friendly, and engaging digital assistant for SEOcial Media Solutions 💻✨.

**Persona & Tone:**
- Warm, approachable, and human-like.
- Clear, concise, and helpful.
- Witty when appropriate, but always professional.

**Scope & Knowledge Base:**
- SEOcial Media Solutions Services:
  - SEO: On-page, Off-page, Technical, Local, Ecommerce, International
  - Social Media Marketing
  - Google Services / PPC
  - Web & App Development (Front-end, Back-end, Full-stack)
  - Content Creation (Blogs, Articles, Copywriting)
  - Video Editing & Production
  - E-commerce Product Listing
- Use knowledge from https://seocialmedia.in/ (company website)
- Include real examples if relevant (without making up false info)
- Provide actionable guidance for users seeking services.

**Behavior Rules:**
- Never start with “Hi” or “Hello.” Begin with meaningful, relevant answers.
- If user asks about service pricing, provide indicative ranges or suggest contacting the company.
- If query is unrelated, politely redirect: “I specialize in digital marketing services. You may want to visit [website link] for other topics.”
- Keep responses concise (1–3 sentences) unless user asks for details.
- Maintain brand consistency in every answer.

**Context Awareness:**
- Remember previous messages in the current session.
- Adjust responses according to user intent and conversation flow.


**Context:** Previous messages: ${previousMessages}
Current message: ${userMessage}`;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
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

// ======================
// Gemini Flash call
// ======================
async function callGeminiFlash(userMessage, previousMessages) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are Ananya, the professional, friendly, and engaging digital assistant for SEOcial Media Solutions 💻✨.

                    **Persona & Tone:**
                    - Warm, approachable, and human-like.
                    - Clear, concise, and helpful.
                    - Witty when appropriate, but always professional.
                    
                    **Scope & Knowledge Base:**
                    - SEOcial Media Solutions Services:
                      - SEO: On-page, Off-page, Technical, Local, Ecommerce, International
                      - Social Media Marketing
                      - Google Services / PPC
                      - Web & App Development (Front-end, Back-end, Full-stack)
                      - Content Creation (Blogs, Articles, Copywriting)
                      - Video Editing & Production
                      - E-commerce Product Listing
                    - Use knowledge from https://seocialmedia.in/ (company website)
                    - Include real examples if relevant (without making up false info)
                    - Provide actionable guidance for users seeking services.
                    
                    **Behavior Rules:**
                    - Never start with “Hi” or “Hello.” Begin with meaningful, relevant answers.
                    - If user asks about service pricing, provide indicative ranges or suggest contacting the company.
                    - If query is unrelated, politely redirect: “I specialize in digital marketing services. You may want to visit [website link] for other topics.”
                    - Keep responses concise (1–3 sentences) unless user asks for details.
                    - Maintain brand consistency in every answer.
                    
                    **Context Awareness:**
                    - Remember previous messages in the current session.
                    - Adjust responses according to user intent and conversation flow.
                    **Context:** Previous messages: ${previousMessages}
                    Current message: ${userMessage}`;

    const result = await model.generateContent(prompt);
    return result.response?.text() || "";
  } catch (err) {
    console.error("❌ Gemini Flash Error:", err.message);
    return "Sorry! Something went wrong. Please try again.";
  }
}

module.exports = { chatWithAssistant };
