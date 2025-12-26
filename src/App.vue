<template>
  <div class="app-container">
    <header><h1>AI Fashion Transformer</h1></header>

    <div v-if="step === 'select'" class="step-container">
      <h3>1. 変身したいスタイルを選択してください</h3>
      <div class="style-grid">
        <button v-for="(name, key) in styleNames" :key="key" @click="selectStyle(key)" class="style-card">
          {{ name }}
        </button>
      </div>
    </div>

    <div v-if="step === 'camera'" class="step-container">
      <div class="view-panel">
        <video ref="video" autoplay playsinline></video>
        <div v-if="countdown > 0" class="countdown-overlay">{{ countdown }}</div>
      </div>
      
      <div class="controls">
        <div class="camera-selector-area">
          <label for="camera-select">カメラを選択:</label>
          <select id="camera-select" v-model="selectedCamera" @change="initCamera" class="camera-select">
            <option v-for="device in cameraDevices" :key="device.deviceId" :value="device.deviceId">
              {{ device.label || `カメラ ${cameraDevices.indexOf(device) + 1}` }}
            </option>
          </select>
        </div>

        <button @click="startCountdown" :disabled="countdown > 0" class="btn-shutter">
          {{ countdown > 0 ? '準備中...' : '5秒後に撮影' }}
        </button>
        <button @click="stopCameraAndBack" class="btn-cancel">戻る</button>
      </div>
    </div>

    <div v-if="step === 'result'" class="step-container">
      <h3>{{ loading ? 'AIが生成中...' : '完成！自由にデコってみよう' }}</h3>
      <div class="view-panel">
        <img v-if="transformedImg" :src="'data:image/png;base64,' + transformedImg" class="result-img" />
        <canvas 
          v-if="!loading"
          ref="drawCanvas" 
          @mousedown="startDrawing" @mousemove="draw" @mouseup="stopDrawing" @mouseleave="stopDrawing"
          @touchstart.prevent="startDrawing" @touchmove.prevent="draw" @touchend.prevent="stopDrawing"
          width="768" height="1024"
        ></canvas>
        <div v-if="loading" class="loading-overlay">
          <div class="spinner"></div>
          <p>AIが仕立て直しています...</p>
        </div>
      </div>

      <div v-if="!loading && transformedImg" class="toolbar">
        <div class="tool-item"><label>色:</label><input type="color" v-model="penColor" /></div>
        <div class="tool-item"><label>太さ:</label><input type="range" min="1" max="50" v-model="penWidth" /></div>
        <button @click="clearCanvas" class="btn-small">消去</button>
        <button @click="downloadImage" class="btn-download">画像を保存</button>
      </div>

      <div v-if="!loading" class="controls">
        <button @click="reset" class="btn-primary">トップへ戻る</button>
      </div>
    </div>

    <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    <canvas ref="hiddenCanvas" width="768" height="1024" style="display:none;"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const step = ref('select');
const selectedStyle = ref('');
const countdown = ref(0);
const loading = ref(false);
const errorMsg = ref('');
const video = ref(null);
const drawCanvas = ref(null);
const hiddenCanvas = ref(null);

// カメラ関連の状態
const cameraDevices = ref([]);
const selectedCamera = ref('');
const currentStream = ref(null);

const transformedImg = ref(null);
const isDrawing = ref(false);
const penColor = ref('#ff0000');
const penWidth = ref(10);

const styleNames = {
  samurai: '鎧武者', otaku: '90sオタク', jirai: 'ゴスロリ', sumo: '相撲力士', kappogi: '割烹着',
  tobi: '鳶服', decora: 'デコラー', walolita: '和ロリ', yankee: '特攻服', monk: '現代僧侶'
};

const PROMPTS = {
  samurai: "Completely replace the person's outfit with samurai armor. Photorealistic.",
  otaku: "90s Akihabara Otaku style, bandana, anime poster in backpack. Photorealistic.",
  jirai: "Gothic Lolita Jirai-kei black dress, Hime-cut hair. Photorealistic.",
  sumo: "Sumo wrestler (Rikishi), Mawashi belt. Photorealistic.",
  kappogi: "Japanese white Kappogi apron. Photorealistic.",
  tobi: "Japanese construction worker Tobi-fuku. Photorealistic.",
  decora: "Decora fashion, colorful hair clips, Harajuku style. Photorealistic.",
  walolita: "Wa-Lolita fashion, Kimono fusion. Photorealistic.",
  yankee: "Japanese Yankee Tokkou-fuku coat. Photorealistic.",
  monk: "Japanese monk Samue robe. Photorealistic."
};

// 利用可能なカメラ一覧を取得
const updateCameraList = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    cameraDevices.value = devices.filter(device => device.kind === 'videoinput');
    // デフォルトカメラの設定
    if (cameraDevices.value.length > 0 && !selectedCamera.value) {
      selectedCamera.value = cameraDevices.value[0].deviceId;
    }
  } catch (err) {
    errorMsg.value = "カメラ一覧の取得に失敗しました。";
  }
};

const initCamera = async () => {
  // 既存のストリームがあれば停止
  if (currentStream.value) {
    currentStream.value.getTracks().forEach(track => track.stop());
  }

  if (!selectedCamera.value) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        deviceId: { exact: selectedCamera.value },
        width: { ideal: 768 },
        height: { ideal: 1024 }
      }
    });
    currentStream.value = stream;
    if (video.value) {
      video.value.srcObject = stream;
    }
  } catch (err) {
    errorMsg.value = "カメラの起動に失敗しました。外付けカメラの接続を確認してください。";
  }
};

const selectStyle = async (key) => {
  selectedStyle.value = key;
  step.value = 'camera';
  // 初回のみ権限許可を得るためにダミーの起動を行い、リストを更新
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(t => t.stop());
    await updateCameraList();
    await initCamera();
  } catch (e) {
    errorMsg.value = "カメラの使用を許可してください。";
  }
};

const stopCameraAndBack = () => {
  if (currentStream.value) {
    currentStream.value.getTracks().forEach(track => track.stop());
  }
  step.value = 'select';
};

const startCountdown = () => {
  countdown.value = 5;
  const timer = setInterval(() => {
    countdown.value--;
    if (countdown.value === 0) { 
      clearInterval(timer); 
      captureAndGenerate(); 
    }
  }, 1000);
};

const captureAndGenerate = async () => {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 768; tempCanvas.height = 1024;
  tempCanvas.getContext('2d').drawImage(video.value, 0, 0, 768, 1024);
  const base64 = tempCanvas.toDataURL('image/png').split(',')[1];
  
  // カメラを止める
  if (currentStream.value) {
    currentStream.value.getTracks().forEach(track => track.stop());
  }

  step.value = 'result';
  loading.value = true;
  errorMsg.value = '';

  const endpoint = import.meta.env.DEV ? 'http://localhost:3001/generate' : '/generate';

  try {
    const res = await axios.post(endpoint, {
      prompt: PROMPTS[selectedStyle.value],
      imageBase64: base64
    });
    transformedImg.value = res.data.image;
  } catch (err) { 
    errorMsg.value = "AI生成失敗: " + (err.response?.data?.error || err.message);
  } finally { 
    loading.value = false; 
  }
};

// --- お絵描き機能 ---
const startDrawing = (e) => { isDrawing.value = true; draw(e); };
const stopDrawing = () => { isDrawing.value = false; if(drawCanvas.value) drawCanvas.value.getContext('2d').beginPath(); };
const draw = (e) => {
  if (!isDrawing.value || !drawCanvas.value) return;
  const ctx = drawCanvas.value.getContext('2d');
  const rect = drawCanvas.value.getBoundingClientRect();
  const x = ((e.clientX || e.touches?.[0].clientX) - rect.left) * (768 / rect.width);
  const y = ((e.clientY || e.touches?.[0].clientY) - rect.top) * (1024 / rect.height);
  ctx.lineWidth = penWidth.value; ctx.lineCap = 'round'; ctx.strokeStyle = penColor.value;
  ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
};
const clearCanvas = () => { if(drawCanvas.value) drawCanvas.value.getContext('2d').clearRect(0, 0, 768, 1024); };

const downloadImage = () => {
  const ctx = hiddenCanvas.value.getContext('2d');
  const aiImg = new Image();
  aiImg.src = 'data:image/png;base64,' + transformedImg.value;
  aiImg.onload = () => {
    ctx.drawImage(aiImg, 0, 0, 768, 1024);
    if (drawCanvas.value) ctx.drawImage(drawCanvas.value, 0, 0);
    const link = document.createElement('a');
    link.download = `transformed-${selectedStyle.value}.png`;
    link.href = hiddenCanvas.value.toDataURL('image/png');
    link.click();
  };
};

const reset = () => {
  step.value = 'select'; transformedImg.value = null; errorMsg.value = '';
};
</script>

<style scoped>
.app-container { max-width: 900px; margin: 0 auto; text-align: center; font-family: 'Helvetica Neue', Arial, sans-serif; padding-bottom: 50px; color: #333; }
.style-grid { color: #000; display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px; padding: 20px; }
.style-card { color: #000; height: 80px; border-radius: 12px; border: 2px solid #eee; background: #fff; cursor: pointer; font-weight: bold; transition: all 0.3s; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
.style-card:hover { transform: translateY(-2px); border-color: #42b983; background: #f0fff4; }

.view-panel { position: relative; width: 450px; height: 600px; margin: 0 auto; background: #1a1a1a; border-radius: 20px; overflow: hidden; border: 8px solid #333; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
video, .result-img { width: 100%; height: 100%; object-fit: cover; }
canvas { position: absolute; inset: 0; z-index: 5; cursor: crosshair; }

.camera-selector-area { margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 10px; display: inline-block; }
.camera-select { padding: 8px 12px; border-radius: 6px; border: 1px solid #ccc; margin-left: 10px; min-width: 200px; font-size: 14px; }

.countdown-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 120px; color: white; background: rgba(0,0,0,0.4); z-index: 10; font-weight: bold; text-shadow: 0 0 20px rgba(0,0,0,0.5); }
.loading-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.85); color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 20; }

.toolbar { display: flex; justify-content: center; align-items: center; gap: 20px; padding: 15px; background: #f1f3f5; margin: 20px 0; border-radius: 15px; }
.tool-item { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: bold; }

.controls { margin-top: 20px; display: flex; flex-direction: column; gap: 12px; align-items: center; }
button { padding: 14px 28px; border-radius: 50px; border: none; cursor: pointer; font-weight: bold; transition: opacity 0.2s; }
button:disabled { cursor: not-allowed; opacity: 0.6; }

.btn-shutter { background: #ff4757; color: white; width: 250px; font-size: 1.2em; box-shadow: 0 4px 15px rgba(255, 71, 87, 0.3); }
.btn-primary { background: #2ed573; color: white; }
.btn-download { background: #1e90ff; color: white; }
.btn-cancel { background: #a4b0be; color: white; }
.btn-small { padding: 8px 16px; border-radius: 8px; background: #fff; border: 1px solid #ddd; }

.spinner { width: 50px; height: 50px; border: 5px solid rgba(255,255,255,0.2); border-top: 5px solid #2ed573; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 15px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.error { color: #ff4757; font-weight: bold; background: #fff5f5; padding: 10px; border-radius: 8px; margin-top: 20px; display: inline-block; }
</style>