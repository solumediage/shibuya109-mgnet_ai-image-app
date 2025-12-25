// netlify/functions/generate.js
import express from "express";
import cors from "cors";
import serverless from "serverless-http";
import fetch from "node-fetch";

const app = express();

// 502を避けるためにCORSとJSONパースを確実に設定
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY;
const MODEL_NAME = process.env.IMAGE_MODEL_NAME;

// ルーティング
const router = express.Router();

router.post("/", async (req, res) => {
  console.log("API Request received"); // Netlifyログに表示されます
  try {
    const { prompt, imageBase64 } = req.body;
    
    if (!API_KEY || !MODEL_NAME) {
      console.error("Missing Environment Variables");
      return res.status(500).json({ error: "サーバーの設定（環境変数）が不足しています。" });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/png", data: imageBase64 } }
          ]
        }],
        generationConfig: { responseModalities: ["IMAGE"] }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", JSON.stringify(data));
      return res.status(response.status).json({ error: data.error?.message || "Gemini APIエラー" });
    }

    const resultImage = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    if (!resultImage) {
      return res.status(500).json({ error: "AIからの画像返却に失敗しました。" });
    }

    res.json({ image: resultImage });
  } catch (error) {
    console.error("Internal Function Error:", error);
    res.status(500).json({ error: "サーバー内部でエラーが発生しました。" });
  }
});

// Netlifyのパス構造に合わせる
app.use("/.netlify/functions/generate", router);
app.use("/generate", router);

export const handler = serverless(app);