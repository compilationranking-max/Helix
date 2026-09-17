require("dotenv").config();

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
const PORT = 3000;
const MODEL = process.env.HELIX_AI_MODEL || "gpt-5.6-sol";
const MAX_HISTORY_MESSAGES = 20;

const HELIX_AI_INSTRUCTIONS = `
You are HELIX AI, the built-in AI assistant of the Helix platform.
When asked who you are or what your name is, identify yourself as HELIX AI.
Never introduce yourself as ChatGPT unless the user explicitly asks which underlying AI or model powers you.
Do not say that you were created by OpenAI during normal introductions.
You are not human and must not claim to be human.
Maintain a futuristic, intelligent, technical personality suited to Helix's dark-terminal cyberpunk identity.
Be helpful, natural, conversational, and reasonably concise. Understand context instead of blindly repeating the user's wording.
Use the recent conversation history to answer references and follow-up questions accurately.
If the user says you are Helix AI, acknowledge it naturally rather than correcting them.
In normal conversation, refer to yourself as Helix AI or Helix.
`;

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Helix AI backend is running!");
});

function buildConversationInput(history, message) {
    const validHistory = Array.isArray(history)
        ? history.filter((item) => (
            item &&
            (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string" &&
            item.content.trim()
        ))
        : [];

    const recentHistory = validHistory.slice(-MAX_HISTORY_MESSAGES);
    const lastMessage = recentHistory[recentHistory.length - 1];

    if (message && (!lastMessage || lastMessage.role !== "user" || lastMessage.content !== message)) {
        recentHistory.push({ role: "user", content: message });
    }

    return recentHistory.slice(-MAX_HISTORY_MESSAGES).map(({ role, content }) => ({
        role,
        content
    }));
}

app.post("/api/chat", async (req, res) => {
    try {
        const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
        const input = buildConversationInput(req.body.history, message);

        if (!input.length) {
            return res.status(400).json({
                error: "Please enter a message for Helix AI."
            });
        }

        const response = await client.responses.create({
            model: MODEL,
            instructions: HELIX_AI_INSTRUCTIONS,
            input
        });

        res.json({
            reply: response.output_text
        });
    } catch (error) {
        console.error("Helix AI request failed:", error.message);
        const status = error.status === 429 ? 429 : 500;
        res.status(status).json({
            error: status === 429
                ? "Helix AI is rate-limited right now. Please try again shortly."
                : "Helix AI failed to respond. Please try again shortly."
        });
    }
});

app.listen(PORT, () => {
    console.log(`Helix backend running at http://localhost:${PORT}`);
});