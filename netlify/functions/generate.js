import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import serverless from "serverless-http"; // 追加

dotenv.config();

const app = express();

// Netlify環境ではCORS設定が不要な場合も多いですが、念のため残します
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY;
const MODEL_NAME = process.env.IMAGE_MODEL_NAME; 

// ルートを /generate に合わせる
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { prompt, imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "画像が必要です" });

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
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message });
    const resultImage = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    if (!resultImage) throw new Error("画像が生成されませんでした。");

    res.json({ image: resultImage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Netlify Functionsのエンドポイント名に合わせるためのルーティング
app.use("/.netlify/functions/generate", router);

// serverless-httpでラップしてexport
export const handler = serverless(app);