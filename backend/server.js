require("dotenv").config();

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
const PORT = 3000;

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Helix AI backend is running!");
});

app.post("/api/chat", async (req, res) => {
    try {
        const message = req.body.message;

        const response = await client.responses.create({
            model: "gpt-5.6-luna",
            input: message
        });

        res.json({
            reply: response.output_text
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Helix AI failed to respond."
        });
    }
});

app.listen(PORT, () => {
    console.log(`Helix backend running at http://localhost:${PORT}`);
});