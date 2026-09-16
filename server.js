const express = require("express");
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.use(express.json());
app.use(express.static(__dirname));

app.post("/api/ask", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: message,
    });

    res.json({
      reply: response.text,
    });
  } catch (error) {
    console.error("Gemini error:", error);
    res.status(500).json({
      error: "Failed to get a response from Gemini.",
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Helix server running on port ${PORT}`);
});

server.on("error", (error) => {
  console.error("Server error:", error);
});