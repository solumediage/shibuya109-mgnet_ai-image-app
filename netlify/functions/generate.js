import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();

// 大容量の画像データを扱うための設定
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY;
const MODEL_NAME = process.env.IMAGE_MODEL_NAME;

app.post("/generate", async (req, res) => {
  try {
    const { prompt, imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "画像データが必要です" });
    }

    // Google AI Studio API エンドポイント
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
        generationConfig: {
          responseModalities: ["IMAGE"] // 画像出力モード
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "API Error" });
    }

    const resultPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    const resultImage = resultPart?.inlineData?.data;

    if (!resultImage) {
      throw new Error("AIが画像を生成しませんでした。");
    }

    res.json({ image: resultImage });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));