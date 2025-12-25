import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

async function listModels() {
  const API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    console.log("--- 利用可能なモデル一覧 ---");
    data.models.forEach(model => {
      console.log(`モデル名: ${model.name}`);
      console.log(`サポート機能: ${model.supportedGenerationMethods.join(", ")}`);
      console.log('---');
    });
  } catch (error) {
    console.error("エラーが発生しました:", error);
  }
}

listModels();