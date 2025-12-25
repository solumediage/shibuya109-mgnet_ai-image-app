import serverless from "serverless-http";
import express from "express";
import cors from "cors";
import axios from "axios"; // node-fetchの代わりに、より安定したaxiosを使用

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY;
const MODEL_NAME = process.env.IMAGE_MODEL_NAME;

app.post("/.netlify/functions/generate", async (req, res) => {
  console.log("--- Function Start ---");
  
  try {
    const { prompt, imageBase64 } = req.body;

    if (!API_KEY) throw new Error("API_KEY is missing");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
    
    const response = await axios.post(url, {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/png", data: imageBase64 } }
        ]
      }],
      generationConfig: { responseModalities: ["IMAGE"] }
    });

    const resultImage = response.data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

    if (!resultImage) throw new Error("No image returned from Gemini");

    res.json({ image: resultImage });
  } catch (error) {
    console.error("Error details:", error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

export const handler = serverless(app);