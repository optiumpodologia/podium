/* ============================================================
 * foto.js — Procesa una foto de perfil (detecta el rostro, recorta
 * centrado en la cara, escala a 500x500 y comprime a JPEG) y la sube
 * a Supabase Storage. Reutilizable: profesionales, negocio, etc.
 *
 * Requiere face-api cargado por <script> ANTES que este archivo:
 *   <script src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js"></script>
 *
 * Si face-api no carga (sin red, etc.), igual funciona: usa un
 * encuadre por defecto en vez de la cara.
 *
 * Uso:  const url = await fotoSubir(file, `${negId}/prof-${id}.jpg`);
 * Basado en el módulo del proyecto "Presentismo".
 * ============================================================ */

const FOTO_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';
const FOTO_OUT = 500;            // salida cuadrada 500x500
const FOTO_EYE_Y = 0.44;         // ojos al 44% de la altura
const FOTO_CHIN_Y = 0.78;        // mentón al 78% de la altura
const FOTO_BUCKET = 'fotos';
let fotoFaceReady = false;

async function fotoLoadFace() {
  if (typeof faceapi === 'undefined') { console.warn('face-api no cargado'); return; }
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri(FOTO_MODEL_URL);
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(FOTO_MODEL_URL);
    fotoFaceReady = true;
  } catch (e) {
    console.warn('Detección de rostro no disponible; se usa encuadre por defecto', e);
    fotoFaceReady = false;
  }
}

function fotoAvg(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

function fotoLoadImg(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => res({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

async function fotoDetectFace(img) {
  if (!fotoFaceReady) return null;
  try {
    const det = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 800, scoreThreshold: 0.3 }))
      .withFaceLandmarks(true);
    return det || null;
  } catch (e) { console.warn('detect err', e); return null; }
}

function fotoClampCrop(c, natW, natH) {
  c.side = Math.max(40, Math.min(c.side, Math.max(natW, natH) * 1.3));
  return c;
}

function fotoAutoCropFromFace(natW, natH, det) {
  const lm = det && det.landmarks;
  if (lm) {
    const eyes = [...lm.getLeftEye(), ...lm.getRightEye()];
    const jaw = lm.getJawOutline();
    const eyeY = fotoAvg(eyes.map(p => p.y));
    const eyeX = fotoAvg(eyes.map(p => p.x));
    const chinY = jaw[8].y;
    let side = (chinY - eyeY) / (FOTO_CHIN_Y - FOTO_EYE_Y);
    side = Math.min(Math.max(side, 40), Math.max(natW, natH) * 1.3);
    const top = chinY - FOTO_CHIN_Y * side;
    return fotoClampCrop({ left: eyeX - side / 2, top, side }, natW, natH);
  }
  const box = det && det.detection ? det.detection.box : (det && det.box ? det.box : det);
  const fh = box.height, fw = box.width;
  const side = Math.min(fh * 2.6, Math.max(natW, natH));
  const cx = box.x + fw / 2, cy = box.y + fh / 2;
  return fotoClampCrop({ left: cx - side / 2, top: cy - side * 0.58, side }, natW, natH);
}

function fotoDefaultCrop(natW, natH) {
  if (natH >= natW) {
    const side = natW * 0.62;
    return fotoClampCrop({ left: (natW - side) / 2, top: natH * 0.05, side }, natW, natH);
  }
  const side = Math.min(natW, natH) * 0.8;
  return fotoClampCrop({ left: (natW - side) / 2, top: (natH - side) / 2, side }, natW, natH);
}

function fotoSampleBg(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const corners = [[2, 2], [c.width - 3, 2], [2, c.height - 3]];
  let r = 0, g = 0, b = 0;
  corners.forEach(([px, py]) => { const d = x.getImageData(px, py, 1, 1).data; r += d[0]; g += d[1]; b += d[2]; });
  return `rgb(${Math.round(r / 3)},${Math.round(g / 3)},${Math.round(b / 3)})`;
}

function fotoRenderCropBlob(img, crop, bg) {
  const cv = document.createElement('canvas');
  cv.width = FOTO_OUT; cv.height = FOTO_OUT;
  const x = cv.getContext('2d');
  x.fillStyle = bg || '#E4EAF0';
  x.fillRect(0, 0, FOTO_OUT, FOTO_OUT);
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  const s = FOTO_OUT / crop.side;
  x.drawImage(img, (0 - crop.left) * s, (0 - crop.top) * s, img.naturalWidth * s, img.naturalHeight * s);
  return new Promise(resolve => cv.toBlob(b => resolve(b), 'image/jpeg', 0.82));
}

// Procesa el File y devuelve un Blob JPEG cuadrado, centrado en la cara y liviano.
async function fotoProcesar(file) {
  if (!fotoFaceReady) await fotoLoadFace();
  const { img } = await fotoLoadImg(file);
  const natW = img.naturalWidth, natH = img.naturalHeight;
  const bg = fotoSampleBg(img);
  const det = await fotoDetectFace(img);
  const crop = det ? fotoAutoCropFromFace(natW, natH, det) : fotoDefaultCrop(natW, natH);
  return await fotoRenderCropBlob(img, crop, bg);
}

// Procesa y sube al bucket 'fotos' en `path`. Devuelve la URL pública (con cache-bust).
async function fotoSubir(file, path) {
  const blob = await fotoProcesar(file);
  const { error } = await sb.storage.from(FOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = sb.storage.from(FOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl + '?v=' + Date.now();
}

/* ============================================================
 * LOGO del negocio — sin detección de cara.
 * Un logo no es un rostro: solo lo encuadramos entero ("contain")
 * en un cuadrado, centrado, y lo achicamos/comprimimos.
 * Uso:  const url = await logoSubir(file, `${negId}/logo.jpg`);
 * ============================================================ */

async function logoProcesar(file) {
  const { img } = await fotoLoadImg(file);
  const natW = img.naturalWidth, natH = img.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = FOTO_OUT; cv.height = FOTO_OUT;
  const x = cv.getContext('2d');
  // Fondo: muestreamos una esquina (suele ser el fondo del logo).
  x.fillStyle = fotoSampleBg(img);
  x.fillRect(0, 0, FOTO_OUT, FOTO_OUT);
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  // "contain": el logo entra entero, centrado, sin deformarse.
  const escala = Math.min(FOTO_OUT / natW, FOTO_OUT / natH);
  const w = natW * escala, h = natH * escala;
  x.drawImage(img, (FOTO_OUT - w) / 2, (FOTO_OUT - h) / 2, w, h);
  return new Promise(resolve => cv.toBlob(b => resolve(b), 'image/jpeg', 0.85));
}

async function logoSubir(file, path) {
  const blob = await logoProcesar(file);
  const { error } = await sb.storage.from(FOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = sb.storage.from(FOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl + '?v=' + Date.now();
}
