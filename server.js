import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY;
const MODEL = process.env.IMAGE_MODEL_NAME || 'gemini-1.5-flash';

// 起動時にAPIキーの状態を確認
if (!API_KEY) {
  console.error("❌ ERROR: APIキーが.envファイルに見つかりません。");
} else {
  console.log(`✅ APIキーをロードしました: ${API_KEY.slice(0, 5)}...`);
}

app.post('/generate', async (req, res) => {
  console.log("--- AI Generation Request Received ---");
  try {
    const { prompt, imageBase64 } = req.body;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
    
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
    
    if (!resultImage) {
      throw new Error("AI did not return an image. Check prompt or API limits.");
    }

    res.json({ image: resultImage });
    console.log("--- Generation Success ---");
  } catch (error) {
    console.error("Local Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Local Backend Server: http://localhost:${PORT}`);
});