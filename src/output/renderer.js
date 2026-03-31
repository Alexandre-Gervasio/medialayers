// ============================================================
// output/renderer.js — Renderização da janela de saída
// Parte 6: suporte a NDI entrada e saída
// ============================================================

// Declarações únicas de variáveis globais
const layersContainer = document.getElementById('layers-container');
const layerText = document.getElementById('layer-text');
const activeElements = {}; // { layerId: wrapperElement }
const cameraStreams = {}; // { layerId: MediaStream }
const ndiCanvases = {}; // { layerId: canvas }

// ─────────────────────────────────────────────
// BROADCAST CHANNEL — câmeras locais
// ─────────────────────────────────────────────
const streamChannel = new BroadcastChannel('medialayers-streams');

streamChannel.onmessage = async (event) => {
  const msg = event.data;
  if (msg.type === 'camera-stream') {
    await openCameraInOutput(msg.layerId, msg.deviceId, msg.opacity, msg.visible);
  }
  if (msg.type === 'camera-remove') {
    removeCameraFromOutput(msg.layerId);
  }
};

async function openCameraInOutput(layerId, deviceId, opacity, visible) {
  try {
    if (cameraStreams[layerId]) {
      cameraStreams[layerId].getTracks().forEach(t => t.stop());
    }
    const constraints = deviceId
      ? { video: { deviceId: { exact: deviceId }, width: 1920, height: 1080 }, audio: false }
      : { video: { width: 1920, height: 1080 }, audio: false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraStreams[layerId] = stream;
    let wrapper = activeElements[layerId];
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'output-layer';
      wrapper.dataset.id = layerId;
      layersContainer.appendChild(wrapper);
      activeElements[layerId] = wrapper;
    }
    wrapper.innerHTML = '';
    wrapper.style.opacity = visible ? opacity : 0;
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    wrapper.appendChild(video);
    video.play().catch(() => {});
  } catch (err) {
    console.error('[MediaLayers] Erro ao abrir câmera na saída:', err);
  }
}

function removeCameraFromOutput(layerId) {
  if (cameraStreams[layerId]) {
    cameraStreams[layerId].getTracks().forEach(t => t.stop());
    delete cameraStreams[layerId];
  }
  const wrapper = activeElements[layerId];
  if (wrapper && wrapper.parentNode) {
    wrapper.parentNode.removeChild(wrapper);
    delete activeElements[layerId];
  }
}

// ─────────────────────────────────────────────
// NDI — recebe frames do processo principal e
// desenha num <canvas> como camada
// ─────────────────────────────────────────────
window.mediaLayers.onNdiFrame(({ layerId, frame }) => {
  let wrapper = activeElements[layerId];
  let canvas = ndiCanvases[layerId];

  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'output-layer';
    wrapper.dataset.id = layerId;
    layersContainer.appendChild(wrapper);
    activeElements[layerId] = wrapper;
  }

  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    wrapper.appendChild(canvas);
    ndiCanvases[layerId] = canvas;
  }

  canvas.width = frame.xres;
  canvas.height = frame.yres;

  const ctx = canvas.getContext('2d');
  const imageData = new ImageData(
    new Uint8ClampedArray(frame.data),
    frame.xres,
    frame.yres
  );
  ctx.putImageData(imageData, 0, 0);
});

// ─────────────────────────────────────────────
// NDI SAÍDA — captura a tela e envia frames
// ─────────────────────────────────────────────
let ndiOutputInterval = null;
const ndiOutputCanvas = document.createElement('canvas');
const ndiOutputCtx = ndiOutputCanvas.getContext('2d');

function startNDIOutputCapture() {
  if (ndiOutputInterval) return;

  ndiOutputInterval = setInterval(async () => {
    try {
      const frame = await window.mediaLayers.captureOutputFrame()
      if (!frame || !frame.data || frame.data.length === 0) return

      window.mediaLayers.sendNdiOutputFrame({
        width: frame.width,
        height: frame.height,
        data: new Uint8Array(frame.data)
      })
    } catch (e) {
      console.error('[MediaLayers] Erro ao capturar/Enviar frame NDI:', e)
    }
  }, 1000 / 15) // 15fps mais robusto
}

// ─────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────
window.mediaLayers.outputReady();
console.log('[MediaLayers] Janela de saída pronta (com NDI).');

// ─────────────────────────────────────────────
// RECEBER COMANDOS DO PAINEL DE CONTROLE
// ─────────────────────────────────────────────
window.mediaLayers.onCommand((payload) => {
  if (payload.type === 'update-layers') renderLayers(payload.layers);
  if (payload.type === 'clear') clearAll();
  if (payload.type === 'ndi-output-start') startNDIOutputCapture();
  if (payload.type === 'ndi-output-stop') {
    clearInterval(ndiOutputInterval);
    ndiOutputInterval = null;
  }
});

// ─────────────────────────────────────────────
// RENDERIZAR CAMADAS
// ─────────────────────────────────────────────
function renderLayers(layers) {
  const activeIds = layers.map(l => l.id);

  Object.keys(activeElements).forEach(id => {
    const numId = parseInt(id);
    if (!activeIds.includes(numId) && !cameraStreams[numId] && !ndiCanvases[numId]) {
      const el = activeElements[id];
      if (el && el.parentNode) el.parentNode.removeChild(el);
      delete activeElements[id];
    }
  });

  layerText.innerHTML = '';

  layers.forEach((layer, index) => {
    if (layer.type === 'text') { renderTextLayer(layer); return; }

    if (layer.type === 'camera') {
      const wrapper = activeElements[layer.id];
      if (wrapper) {
        wrapper.style.opacity = layer.visible ? layer.opacity : 0;
        wrapper.style.zIndex = index + 1;
      }
      return;
    }

    if (layer.type === 'ndi') {
      const wrapper = activeElements[layer.id];
      if (wrapper) {
        wrapper.style.opacity = layer.visible ? layer.opacity : 0;
        wrapper.style.zIndex = index + 1;
      }
      return;
    }

    renderMediaLayer(layer, index);
  });
}

function renderMediaLayer(layer, zIndex) {
  if (activeElements[layer.id]) {
    const wrapper = activeElements[layer.id];
    wrapper.style.opacity = layer.visible ? layer.opacity : 0;
    wrapper.style.zIndex = zIndex + 1;
    const video = wrapper.querySelector('video');
    if (video) { video.loop = layer.loop; video.volume = layer.volume ?? 1; }
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'output-layer';
  wrapper.dataset.id = layer.id;
  wrapper.style.zIndex = zIndex + 1;
  wrapper.style.opacity = layer.visible ? layer.opacity : 0;

  if (layer.type === 'video' && layer.src) {
    const video = document.createElement('video');
    video.src = layer.src; video.loop = layer.loop;
    video.volume = layer.volume ?? 1; video.autoplay = true; video.playsInline = true;
    wrapper.appendChild(video);
    video.play().catch(() => {});
  }

  if (layer.type === 'image' && layer.src) {
    const img = document.createElement('img');
    img.src = layer.src;
    wrapper.appendChild(img);
  }

  if (layer.type === 'audio' && layer.src) {
    const audio = document.createElement('audio');
    audio.src = layer.src; audio.loop = layer.loop;
    audio.volume = layer.volume ?? 1; audio.autoplay = true;
    wrapper.appendChild(audio);
    audio.play().catch(() => {});
  }

  layersContainer.appendChild(wrapper);
  activeElements[layer.id] = wrapper;
}

function renderTextLayer(layer) {
  if (!layer.visible || !layer.text) return;
  const block = document.createElement('div');
  block.className = 'text-block';
  block.textContent = layer.text;
  block.style.cssText = `
    color: ${layer.fontColor || '#ffffff'};
    font-size: ${layer.fontSize || 48}px;
    background: ${layer.fontBg || 'rgba(0,0,0,0.5)'};
    opacity: ${layer.opacity};
    font-family: 'Segoe UI', sans-serif;
    font-weight: 700;
    text-shadow: 2px 2px 8px rgba(0,0,0,0.8);
  `;
  layerText.appendChild(block);
}

function clearAll() {
  Object.keys(cameraStreams).forEach(id => {
    cameraStreams[id].getTracks().forEach(t => t.stop());
    delete cameraStreams[id];
  });
  if (ndiOutputInterval) { clearInterval(ndiOutputInterval); ndiOutputInterval = null; }
  layersContainer.innerHTML = '';
  layerText.innerHTML = '';
  Object.keys(activeElements).forEach(id => delete activeElements[id]);
  Object.keys(ndiCanvases).forEach(id => delete ndiCanvases[id]);
}