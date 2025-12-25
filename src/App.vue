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
        <div class="camera-info">
          <label>カメラ:</label>
          <select v-model="selectedCamera" @change="initCamera" class="camera-select">
            <option v-for="c in cameraDevices" :key="c.deviceId" :value="c.deviceId">
              {{ c.label || `Camera ${c.deviceId.slice(0, 5)}` }}
            </option>
          </select>
        </div>
        <button @click="startCountdown" :disabled="countdown > 0" class="btn-shutter">
          {{ countdown > 0 ? '準備中...' : '5秒後に撮影' }}
        </button>
        <button @click="step = 'select'" class="btn-cancel">戻る</button>
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
          <p>AIが{{ styleNames[selectedStyle] }}に仕立て直しています...</p>
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
import { ref } from 'vue';
import axios from 'axios';

const step = ref('select');
const selectedStyle = ref('');
const countdown = ref(0);
const loading = ref(false);
const errorMsg = ref('');

const video = ref(null);
const drawCanvas = ref(null);
const hiddenCanvas = ref(null);
const cameraDevices = ref([]);
const selectedCamera = ref('');
const transformedImg = ref(null);
const isDrawing = ref(false);
const penColor = ref('#ff0000');
const penWidth = ref(10);

const styleNames = {
  samurai: '鎧武者', otaku: '90sオタク', jirai: 'ゴスロリ', sumo: '相撲力士', kappogi: '割烹着',
  tobi: '鳶服', decora: 'デコラー', walolita: '和ロリ', yankee: '特攻服', monk: '現代僧侶'
};

const PROMPTS = {
  samurai: `Completely replace the person's current outfit, jeans, and sneakers with a full-body set of Kamakura-period "O-yoroi" armor. NO face mask (Menpo), face must be fully visible. Photorealistic.`,
  otaku: `Completely replace the person's current outfit with a realistic "90s Akihabara Otaku" style. A thin, folded bandana around forehead. A slender anime poster rolled into a thin rod-like cylinder poking out from a backpack. Photorealistic.`,
  jirai: "Gothic Lolita Jirai-kei black dress, Hime-cut hair. Photorealistic.",
  sumo: "professional Sumo wrestler (Rikishi), traditional silk Mawashi belt, powerful physique. Photorealistic.",
  kappogi: "traditional Japanese white Kappogi apron over kimono. Photorealistic.",
  tobi: "Japanese construction worker 'Tobi-fuku', baggy trousers, Tabi boots. Photorealistic.",
  decora: "Decora fashion, colorful hair clips, plastic jewelry, Harajuku style. Photorealistic.",
  walolita: "Wa-Lolita fashion, Kimono-Lolita fusion, frilly petticoat. Photorealistic.",
  yankee: "Japanese Yankee 'Tokkou-fuku' long coat with gold kanji embroidery. Photorealistic.",
  monk: "modern Japanese monk, high-quality black Samue robe. Photorealistic."
};

const getDevices = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    cameraDevices.value = devices.filter(d => d.kind === 'videoinput');
    stream.getTracks().forEach(track => track.stop());
    if (cameraDevices.value.length > 0 && !selectedCamera.value) {
      selectedCamera.value = cameraDevices.value[0].deviceId;
    }
  } catch (err) {
    errorMsg.value = "カメラのアクセス許可を確認してください。";
  }
};

const selectStyle = (key) => {
  selectedStyle.value = key;
  step.value = 'camera';
  setTimeout(async () => {
    await getDevices();
    await initCamera();
  }, 100);
};

const initCamera = async () => {
  if (!selectedCamera.value) return;
  if (video.value && video.value.srcObject) {
    video.value.srcObject.getTracks().forEach(track => track.stop());
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { ideal: selectedCamera.value }, width: 768, height: 1024 }
    });
    if (video.value) video.value.srcObject = stream;
  } catch (err) {
    errorMsg.value = "カメラ起動エラー";
  }
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
  // カメラから画像を取得
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 768; tempCanvas.height = 1024;
  tempCanvas.getContext('2d').drawImage(video.value, 0, 0, 768, 1024);
  const base64 = tempCanvas.toDataURL('image/png').split(',')[1];
  
  // ステップを結果表示へ進め、生成開始
  step.value = 'result';
  loading.value = true;
  errorMsg.value = '';

  try {
    const res = await axios.post('/generate', {
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

// --- 画像保存機能 ---
const downloadImage = async () => {
  const ctx = hiddenCanvas.value.getContext('2d');
  const aiImg = new Image();
  aiImg.src = 'data:image/png;base64,' + transformedImg.value;
  aiImg.onload = () => {
    ctx.drawImage(aiImg, 0, 0, 768, 1024);
    if (drawCanvas.value) {
      ctx.drawImage(drawCanvas.value, 0, 0);
    }
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
.app-container { max-width: 900px; margin: 0 auto; text-align: center; font-family: sans-serif; padding-bottom: 50px; }
.style-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px; padding: 20px; }
.style-card { height: 80px; border-radius: 10px; border: 2px solid #ddd; background: #fff; cursor: pointer; font-weight: bold; }
.view-panel { position: relative; width: 450px; height: 600px; margin: 0 auto; background: #000; border-radius: 15px; overflow: hidden; border: 4px solid #333; }
video, .result-img { width: 100%; height: 100%; object-fit: cover; }
canvas { position: absolute; inset: 0; z-index: 5; cursor: crosshair; }
.countdown-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 100px; color: white; background: rgba(0,0,0,0.3); z-index: 10; }
.loading-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.8); color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 20; }
.toolbar { display: flex; justify-content: center; align-items: center; gap: 15px; padding: 15px; background: #f0f0f0; margin: 10px 0; border-radius: 10px; }
.camera-select { padding: 5px; border-radius: 5px; margin-left: 10px; }
.controls { margin-top: 20px; display: flex; flex-direction: column; gap: 10px; align-items: center; }
button { padding: 12px 24px; border-radius: 50px; border: none; cursor: pointer; font-weight: bold; }
.btn-shutter { background: #e74c3c; color: white; width: 220px; }
.btn-primary { background: #42b983; color: white; }
.btn-download { background: #3498db; color: white; }
.btn-cancel { background: #7f8c8d; color: white; }
.btn-small { padding: 5px 15px; border-radius: 5px; background: #fff; border: 1px solid #ccc; }
.spinner { width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #42b983; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 10px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.error { color: #e74c3c; font-weight: bold; }
</style>