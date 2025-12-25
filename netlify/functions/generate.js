// netlify/functions/generate.js
import axios from "axios";

export const handler = async (event, context) => {
  // ログが出力されるか確認
  console.log("--- Function Started ---");

  // POSTメソッド以外を弾く
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { prompt, imageBase64 } = JSON.parse(event.body);
    const API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY;
    const MODEL_NAME = process.env.IMAGE_MODEL_NAME;

    if (!API_KEY || !MODEL_NAME) {
      console.error("Config missing");
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: "環境変数が設定されていません。" }) 
      };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
    
    console.log("Calling Gemini API...");
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
      throw new Error("AIから画像が返却されませんでした。");
    }

    console.log("Success: Image generated");
    return {
      statusCode: 200,
      body: JSON.stringify({ image: resultImage }),
    };

  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};