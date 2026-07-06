import * as THREE from "three";
import { ClothPatch } from "./verlet.js";

const COLS = 12;
const ROWS = 5;
const MAX_FRAMES = 260;

function buildLabelTexture(width, height, label) {
  const canvas = document.createElement("canvas");
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  const radius = 14;
  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, radius);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.font = "500 15px -apple-system, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const text = label.length > 42 ? label.slice(0, 40) + "…" : label;
  ctx.fillText(text, 18, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Rips a task row apart with cloth physics and removes it from the DOM
 * once the patch has fallen out of view. `container` must be a positioned
 * (non-static) ancestor sized to hold the falling patch below the row.
 */
export function tearTaskRow({ container, row, label, onComplete }) {
  const rect = row.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const left = rect.left - containerRect.left;
  const top = rect.top - containerRect.top;
  const fallBound = containerRect.height + 200;

  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.left = `${left}px`;
  canvas.style.top = `${top}px`;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height * 6}px`;
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "50";
  container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height * 6, false);

  // Cloth-space y is 0 at the row's top edge and goes negative as points fall,
  // so the frustum's bottom needs to reach down to -(height * 6).
  const camera = new THREE.OrthographicCamera(0, width, 40, -(height * 6), 0.1, 10);
  camera.position.z = 1;
  const scene = new THREE.Scene();

  const cloth = new ClothPatch({
    cols: COLS,
    rows: ROWS,
    spacing: width / (COLS - 1),
    originX: 0,
    originY: 0,
    pinTop: true,
  });

  const texture = buildLabelTexture(width, height, label);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(cloth.points.length * 3);
  const uvs = new Float32Array(cloth.points.length * 2);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x;
      uvs[i * 2] = x / (COLS - 1);
      uvs[i * 2 + 1] = 1 - y / (ROWS - 1);
    }
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

  const maxIndices = (COLS - 1) * (ROWS - 1) * 6;
  const index = new Uint16Array(maxIndices);
  geometry.setIndex(new THREE.BufferAttribute(index, 1));

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Release the pins right away so the whole patch drops and tears free of the list.
  cloth.releaseAllPins();

  let frame = 0;
  let rafId;

  function updateGeometry() {
    const posAttr = geometry.getAttribute("position");
    for (let i = 0; i < cloth.points.length; i++) {
      const p = cloth.points[i];
      posAttr.setXYZ(i, p.x, p.y, p.z);
    }
    posAttr.needsUpdate = true;

    let count = 0;
    for (let y = 0; y < ROWS - 1; y++) {
      for (let x = 0; x < COLS - 1; x++) {
        if (cloth.isQuadTorn(x, y)) continue;
        const a = y * COLS + x;
        const b = a + 1;
        const c = a + COLS;
        const d = c + 1;
        index[count++] = a;
        index[count++] = c;
        index[count++] = b;
        index[count++] = b;
        index[count++] = c;
        index[count++] = d;
      }
    }
    for (let i = count; i < maxIndices; i++) index[i] = 0;
    const indexAttr = geometry.getIndex();
    indexAttr.array.set(index);
    indexAttr.needsUpdate = true;
    geometry.setDrawRange(0, count);
  }

  function animate() {
    cloth.step();
    updateGeometry();
    renderer.render(scene, camera);

    const lowestY = Math.min(...cloth.points.map((p) => p.y));
    frame++;

    if (lowestY > -fallBound && frame < MAX_FRAMES) {
      rafId = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(rafId);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
      canvas.remove();
      onComplete?.();
    }
  }

  rafId = requestAnimationFrame(animate);
}
