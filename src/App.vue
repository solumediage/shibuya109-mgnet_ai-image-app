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

    <div v-if="step === 'edit'" class="step-container">
      <h3>2. 自由に書き込んでください（任意）</h3>
      <div class="view-panel edit-area">
        <img :src="capturedImg" class="base-layer" />
        <canvas 
          ref="drawCanvas" 
          @mousedown="startDrawing" @mousemove="draw" @mouseup="stopDrawing" @mouseleave="stopDrawing"
          @touchstart.prevent="startDrawing" @touchmove.prevent="draw" @touchend.prevent="stopDrawing"
          width="768" height="1024"
        ></canvas>
      </div>
      
      <div class="toolbar">
        <div class="tool-item"><label>色:</label><input type="color" v-model="penColor" /></div>
        <div class="tool-item"><label>太さ: {{ penWidth }}</label><input type="range" min="1" max="50" v-model="penWidth" /></div>
        <button @click="clearCanvas" class="btn-small">全消去</button>
      </div>

      <div class="controls">
        <button @click="mergeAndGenerate" class="btn-primary">この画像で変身！</button>
        <button @click="step = 'camera'; initCamera();" class="btn-cancel">撮り直し</button>
      </div>
    </div>

    <div v-if="step === 'result'" class="step-container">
      <div class="view-panel">
        <img v-if="transformedImg" :src="'data:image/png;base64,' + transformedImg" class="result-img" />
        <div v-if="loading" class="loading-overlay">
          <div class="spinner"></div>
          <p>AIが{{ styleNames[selectedStyle] }}に仕立て直しています...</p>
        </div>
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
const cameraDevices = ref([]);
const selectedCamera = ref('');
const capturedImg = ref(null);
const transformedImg = ref(null);
const isDrawing = ref(false);
const penColor = ref('#ff0000');
const penWidth = ref(10);

const styleNames = {
  samurai: '鎧武者', otaku: '90sオタク', jirai: 'ゴスロリ', sumo: '相撲力士', kappogi: '割烹着',
  tobi: '鳶服', decora: 'デコラー', walolita: '和ロリ', yankee: '特攻服', monk: '現代僧侶'
};

const PROMPTS = {
  samurai: `Completely replace the person's current outfit, jeans, and sneakers with a full-body set of Kamakura-period "O-yoroi" armor. [Weapons]: At the waist, add two traditional Japanese swords: one long "Tachi" hung with ornate gold-trimmed cords (ashi-kanamono), and one shorter "Wakizashi" tucked firmly into the belt (obi). Both swords must have detailed sharkskin-wrapped hilts (tsuka) and historical scabbards (saya). [Upper Body]: A rigid, box-shaped torso with white-leather "Tsurubashiri" front plate and large "Sode" shoulder shields. [Head]: A heavy "Hoshi-kabuto" helmet with prominent golden "Kuwagata" horns. NO face mask (Menpo), face must be fully visible and uncovered. [Lower Body]: Replace the jeans with voluminous navy-blue "Hakama" trousers. Cover the legs with historical "Suneate" shin guards. [Feet]: Replace the sneakers with traditional "Kegutsu" fur-lined leather boots. Maintain the original person's face, pose, and the exact background. The entire silhouette must be a wide, powerful box-shape. Photorealistic, 8k resolution, museum quality detail.`,
  otaku: `Completely replace the person's current outfit, jeans, and sneakers with a realistic "90s Akihabara Otaku" style. [Accessories]: The person is wearing a black backpack; a long anime poster, rolled extremely tightly into a slender, thin rod-like cylinder (about 3-5cm in diameter), is poking out diagonally from the top zipper. The person is also carrying a paper shopping bag in their left hand. [Head]: Add a thin, folded bandana tied narrowly around his forehead, just above the eyebrows. [Upper Body]: A layered look. The inner is a white t-shirt with a vintage-style colorful anime character graphic. The outer is an unbuttoned, slightly oversized red and blue plaid shirt with visible fabric wrinkles. [Lower Body]: Replace the jeans with "well-worn, sagging denim pants" with realistic creases and a relaxed, slightly loose fit. [Feet]: Replace the current shoes with aged, scuffed white sneakers that have yellowed soles and a worn-down texture. Maintain the original person's face, pose, and background exactly. Focus on the "lived-in" and "unrefined" texture of the clothing. Photorealistic, 8k resolution, high-fidelity fabric details.`,
  jirai: "Gothic Lolita Jirai-kei black dress with lace and ribbons, Hime-cut hair, subtle makeup. Photorealistic.",
  sumo: "professional Sumo wrestler (Rikishi), traditional silk Mawashi belt, bare chest, Chonmage topknot hair, powerful physique. Photorealistic.",
  kappogi: "traditional Japanese white Kappogi apron over kimono, white cotton fabric texture. Photorealistic.",
  tobi: "Japanese construction worker 'Tobi-fuku', baggy trousers, tight-fitting jacket, Tabi boots. Photorealistic.",
  decora: "Decora fashion, colorful hair clips, plastic jewelry, neon clothes, Harajuku style. Photorealistic.",
  walolita: "Wa-Lolita fashion, Kimono-Lolita fusion, frilly petticoat, large ribbon headpiece. Photorealistic.",
  yankee: "Japanese Yankee 'Tokkou-fuku' long coat with gold kanji embroidery, baggy pants, bandages on torso. Photorealistic.",
  monk: "modern Japanese monk, high-quality black Samue or Kesa robe, dignified atmosphere. Photorealistic."
};

// 修正ポイント: 権限を求めてからリストを取得する
const getDevices = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    cameraDevices.value = devices.filter(d => d.kind === 'videoinput');
    
    // 使用した一時的なストリームを停止
    stream.getTracks().forEach(track => track.stop());

    if (cameraDevices.value.length > 0 && !selectedCamera.value) {
      const ext = cameraDevices.value.find(d => d.label.toLowerCase().includes('usb'));
      selectedCamera.value = ext ? ext.deviceId : cameraDevices.value[0].deviceId;
    }
  } catch (err) {
    errorMsg.value = "カメラのアクセス許可が必要です。ブラウザの設定を確認してください。";
  }
};

const selectStyle = (key) => {
  selectedStyle.value = key;
  step.value = 'camera';
  // stepが切り替わってDOMが生成された後にカメラを初期化
  setTimeout(async () => {
    await getDevices();
    await initCamera();
  }, 100);
};

const initCamera = async () => {
  if (!selectedCamera.value) return;
  errorMsg.value = "";

  // 既存ストリームの停止
  if (video.value && video.value.srcObject) {
    video.value.srcObject.getTracks().forEach(track => track.stop());
  }

  try {
    const constraints = {
      video: { 
        deviceId: { ideal: selectedCamera.value },
        width: { ideal: 768 }, 
        height: { ideal: 1024 } 
      }
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    if (video.value) video.value.srcObject = stream;
  } catch (err) {
    console.error(err);
    errorMsg.value = "カメラの起動に失敗しました。";
  }
};

const startCountdown = () => {
  countdown.value = 5;
  const timer = setInterval(() => {
    countdown.value--;
    if (countdown.value === 0) { clearInterval(timer); captureToEdit(); }
  }, 1000);
};

const captureToEdit = () => {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 768; tempCanvas.height = 1024;
  tempCanvas.getContext('2d').drawImage(video.value, 0, 0, 768, 1024);
  capturedImg.value = tempCanvas.toDataURL('image/png');
  step.value = 'edit';
};

const startDrawing = (e) => { isDrawing.value = true; draw(e); };
const stopDrawing = () => { isDrawing.value = false; if(drawCanvas.value) drawCanvas.value.getContext('2d').beginPath(); };
const draw = (e) => {
  if (!isDrawing.value) return;
  const ctx = drawCanvas.value.getContext('2d');
  const rect = drawCanvas.value.getBoundingClientRect();
  const x = ((e.clientX || e.touches?.[0].clientX) - rect.left) * (768 / rect.width);
  const y = ((e.clientY || e.touches?.[0].clientY) - rect.top) * (1024 / rect.height);
  ctx.lineWidth = penWidth.value; ctx.lineCap = 'round'; ctx.strokeStyle = penColor.value;
  ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
};
const clearCanvas = () => { if(drawCanvas.value) drawCanvas.value.getContext('2d').clearRect(0, 0, 768, 1024); };

const mergeAndGenerate = async () => {
  const ctx = hiddenCanvas.value.getContext('2d');
  const img = new Image(); img.src = capturedImg.value;
  await img.decode();
  ctx.drawImage(img, 0, 0);
  ctx.drawImage(drawCanvas.value, 0, 0);
  const mergedBase64 = hiddenCanvas.value.toDataURL('image/png').split(',')[1];
  
  step.value = 'result';
  loading.value = true;
  try {
    const res = await axios.post('/generate', {
      prompt: PROMPTS[selectedStyle.value],
      imageBase64: mergedBase64
    });
    transformedImg.value = res.data.image;
  } catch (err) { 
    errorMsg.value = "AI生成中にエラーが発生しました: " + (err.response?.data?.error || err.message);
  } finally { loading.value = false; }
};

const reset = () => {
  step.value = 'select'; capturedImg.value = null; transformedImg.value = null; errorMsg.value = '';
};
</script>

<style scoped>
.app-container { max-width: 900px; margin: 0 auto; text-align: center; font-family: sans-serif; padding-bottom: 40px; }
.style-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px; padding: 20px; }
.style-card { color: #333; height: 80px; border-radius: 10px; border: 2px solid #ddd; background: #fff; cursor: pointer; font-weight: bold; transition: background 0.2s; }
.style-card:hover { background: #f9f9f9; }
.view-panel { position: relative; width: 450px; height: 600px; margin: 0 auto; background: #000; border-radius: 15px; overflow: hidden; border: 4px solid #333; }
video, .base-layer, .result-img { width: 100%; height: 100%; object-fit: cover; }
canvas { position: absolute; inset: 0; z-index: 5; }
.countdown-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 100px; color: white; background: rgba(0,0,0,0.3); z-index: 10; }
.loading-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.8); color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 20; }
.toolbar { display: flex; justify-content: center; align-items: center; gap: 15px; padding: 10px; background: #f0f0f0; margin: 10px 0; border-radius: 10px; }
.camera-select { margin-left: 10px; padding: 5px; border-radius: 5px; border: 1px solid #ccc; }
.controls { margin-top: 20px; display: flex; flex-direction: column; gap: 10px; align-items: center; }
button { padding: 12px 24px; border-radius: 50px; border: none; cursor: pointer; font-weight: bold; }
.btn-shutter { background: #e74c3c; color: white; width: 220px; font-size: 1.1em; }
.btn-primary { background: #42b983; color: white; }
.btn-cancel { background: #7f8c8d; color: white; }
.error { color: #e74c3c; font-weight: bold; margin-top: 20px; }
.spinner { width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #42b983; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 10px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>