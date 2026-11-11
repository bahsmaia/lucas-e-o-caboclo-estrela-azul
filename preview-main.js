import React from './_preview_vendor/react.js';
const { useEffect, useRef, useState } = React;
import ReactDOMClient from './_preview_vendor/react-dom_client.js';
const { createRoot } = ReactDOMClient;
import * as THREE from './_preview_vendor/three.js';

import { chapters as originalChapters, pagesFor } from './src/chapters.js';
import { createCabocloPointCloudData } from './src/caboclo-particles.js';
import { softenedWatercolorTexture } from './src/story-watercolor.js';
// Oito capítulos e textos fiéis ao GDD da criação da capa.
const DURATION = 60; // tempo efetivo da navegação, sem contar as pausas para leitura
const FIRST_SEGMENT_EASE = 1.55;
const END_SHOW_AT = .962;
// Caminhos relativos à base configurada pelo Vite (funciona também em subpastas).
const asset = filename => `./public/assets/${filename}`;
const STOPS = [.018, .315, .425, .535, .645, .755, .865, .95];

// Travessia curta: primeira história em 5s e 7s de navegação entre paradas.
// Não contam as pausas de leitura; as páginas do mesmo capítulo mudam imediatamente.
// Mantemos as posições originais no rio para preservar o cenário e as aquarelas.
const TRAVEL_POINTS = [0, ...STOPS, 1];
const CHAPTER_TIMES = STOPS.map((_, index) => 5 + index * 7);
const TRAVEL_TIMES = [0, ...CHAPTER_TIMES, DURATION];
function travelTimeAt(progress) {
  const p = Math.min(1, Math.max(0, progress));
  for (let i=1; i<TRAVEL_POINTS.length; i++) {
    if (p<=TRAVEL_POINTS[i]) {
      const frac=(p-TRAVEL_POINTS[i-1])/(TRAVEL_POINTS[i]-TRAVEL_POINTS[i-1]);
      return TRAVEL_TIMES[i-1]+(i===1 ? Math.pow(frac,1/FIRST_SEGMENT_EASE) : frac)*(TRAVEL_TIMES[i]-TRAVEL_TIMES[i-1]);
    }
  }
  return DURATION;
}
function progressAtTravelTime(time) {
  const t = Math.min(DURATION, Math.max(0, time));
  for (let i=1; i<TRAVEL_TIMES.length; i++) {
    if (t<=TRAVEL_TIMES[i]) {
      const frac=(t-TRAVEL_TIMES[i-1])/(TRAVEL_TIMES[i]-TRAVEL_TIMES[i-1]);
      return TRAVEL_POINTS[i-1]+(i===1 ? Math.pow(frac,FIRST_SEGMENT_EASE) : frac)*(TRAVEL_POINTS[i]-TRAVEL_POINTS[i-1]);
    }
  }
  return 1;
}
function advanceTrip(progress, seconds) {
  return progressAtTravelTime(travelTimeAt(progress)+seconds);
}

const CHAPTERS = originalChapters.map((chapter, index) => ({
    ...chapter,
    at: STOPS[index],
    eyebrow: `PARADA ${String(index + 1).padStart(2, '0')} / 08`,
    body: chapter.paragraphs.join('\n\n')
}));
// Cada imagem fica visível ANTES da leitura e continua durante a pausa.
// As paradas 7 e 8 mantêm as animações 3D do Caboclo e do livro.
const STORY_IMAGES = STOPS.slice(0, 6).map((at, index) => ({
    at,
    side: index % 2 === 0 ? 'right' : 'left',
    src: asset(`story-${index + 1}.webp`),
    label: `Ilustração em aquarela da parada ${index + 1}`
}));
function readingSlides(chapter) {
    return pagesFor(chapter, window.innerWidth < 750).map(paragraphs => paragraphs.join('\n\n'));
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = x => x * x * (3 - 2 * x);
function skyFocusAmount(p) {
    const up = smooth(clamp((p - (CHAPTERS[6].at - .045)) / .032, 0, 1));
    const down = smooth(clamp((p - (CHAPTERS[7].at - .077)) / .022, 0, 1));
    return up * (1 - down);
}
function makeRoundParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const glow = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(.32, 'rgba(255,255,255,.94)');
    glow.addColorStop(.63, 'rgba(255,255,255,.48)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
}
function riverX(z) { return Math.sin(z * .018) * 6.2 + Math.sin(z * .043 + 1.15) * 2.8 + Math.sin(z * .009 - .5) * 3.2; }
function random(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function makeFoliageTexture(seed, palette) {
    const r = random(seed), c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    for (let k = 0; k < 150; k++) {
        const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * .44;
        const x = 128 + Math.cos(a) * rad * 245, y = 134 + Math.sin(a) * rad * 180;
        const size = 12 + r() * 28;
        ctx.globalAlpha = .06 + r() * .18;
        ctx.fillStyle = palette[Math.floor(r() * palette.length)];
        ctx.beginPath();
        ctx.ellipse(x, y, size * (.55 + r() * .65), size * (.7 + r() * .4), r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function makeTreeTexture(seed, palette, variant = 1) {
    const r = random(seed), c = document.createElement('canvas');
    c.width = 768;
    c.height = 1024;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = variant === 1 ? 'rgba(56,95,87,0.82)' : 'rgba(47,86,79,0.78)';
    ctx.beginPath();
    ctx.moveTo(370, 980);
    ctx.lineTo(405, 980);
    ctx.lineTo(396, 440);
    ctx.lineTo(374, 440);
    ctx.closePath();
    ctx.fill();
    const centers = variant === 1 ? [[390, 300, 170], [300, 395, 168], [490, 410, 158], [385, 500, 190], [255, 555, 138], [520, 580, 145]] : [[385, 245, 195], [285, 365, 162], [495, 372, 160], [385, 485, 182], [250, 535, 122], [515, 538, 128], [385, 650, 148]];
    centers.forEach((it, idx) => {
        const [cx, cy, base] = it;
        for (let k = 0; k < 20; k++) {
            const size = base * (.30 + r() * .34), x = cx + (r() - .5) * base * .8, y = cy + (r() - .5) * base * .62;
            ctx.globalAlpha = .07 + r() * .12;
            ctx.fillStyle = palette[(idx + k) % palette.length];
            ctx.beginPath();
            ctx.ellipse(x, y, size * (.88 + r() * .22), size * (.76 + r() * .26), r() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    ctx.globalAlpha = .12;
    ctx.strokeStyle = variant === 1 ? '#466e66' : '#4e7a70';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
        const sx = 384 + (r() - .5) * 36, sy = 520 - r() * 140, ex = sx + (r() - .5) * 110, ey = sy - (40 + r() * 90);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo((sx + ex) / 2, sy - 25 - r() * 25, ex, ey);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function makeLeafTexture(seed = 999) {
    const r = random(seed), c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.translate(128, 128);
    ctx.rotate(-0.28);
    const grad = ctx.createLinearGradient(-35, -55, 35, 55);
    grad.addColorStop(0, 'rgba(195,241,160,0.98)');
    grad.addColorStop(.45, 'rgba(80,187,114,0.98)');
    grad.addColorStop(1, 'rgba(22,126,89,0.98)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -78);
    ctx.bezierCurveTo(52, -64, 88, -18, 70, 32);
    ctx.bezierCurveTo(55, 74, 18, 92, 0, 104);
    ctx.bezierCurveTo(-22, 91, -59, 73, -73, 30);
    ctx.bezierCurveTo(-88, -15, -51, -64, 0, -78);
    ctx.fill();
    ctx.strokeStyle = 'rgba(241,255,235,0.92)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -68);
    ctx.quadraticCurveTo(2, 8, 0, 93);
    ctx.stroke();
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 6; i++) {
        const y = -42 + i * 22;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(18 + r() * 9, y - 5 - r() * 5, 34 + r() * 10, y - 14 - r() * 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, y + 4);
        ctx.quadraticCurveTo(-18 - r() * 9, y - r() * 5, -34 - r() * 10, y - 12 - r() * 6);
        ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function makeGrassTexture(seed = 121) {
    const r = random(seed), c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    const ctx = c.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, 1024, 0);
    bg.addColorStop(0, '#accda0');
    bg.addColorStop(.22, '#aed49f');
    bg.addColorStop(.58, '#b8d89b');
    bg.addColorStop(1, '#c1d990');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1024, 1024);
    // Soft watercolor blooms so the ground reads as painted instead of photo-textured.
    const bloomColors = ['#91bb86', '#9bc68d', '#d8e5a8', '#9cc89a', '#83b591', '#d5e49a'];
    for (let i = 0; i < 320; i++) {
        const x = r() * 1024, y = r() * 1024, rx = 28 + r() * 130, ry = 22 + r() * 110;
        ctx.globalAlpha = .05 + r() * .08;
        ctx.fillStyle = bloomColors[Math.floor(r() * bloomColors.length)];
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
    // A very subtle reflective haze near the river-side edge.
    for (let i = 0; i < 140; i++) {
        const x = 20 + r() * 300, y = r() * 1024, w = 40 + r() * 140, h = 12 + r() * 36;
        ctx.globalAlpha = .03 + r() * .05;
        ctx.fillStyle = ['#f7fff0', '#d7f5ee', '#d7f7d8'][Math.floor(r() * 3)];
        ctx.beginPath();
        ctx.ellipse(x, y, w, h, (r() - .5) * .55, 0, Math.PI * 2);
        ctx.fill();
    }
    // Grass blades become denser away from the river, matching the reference language.
    for (let layer = 0; layer < 3; layer++) {
        const density = layer === 0 ? 2400 : layer === 1 ? 1800 : 1100;
        for (let i = 0; i < density; i++) {
            const edgeBias = Math.pow(r(), layer === 0 ? 0.62 : 0.75);
            const x = 60 + edgeBias * 900;
            const y = r() * 1024;
            const growth = clamp((x - 170) / 820, 0, 1);
            const h = (13 + r() * 32) * (0.55 + growth * 1.1) * (layer === 2 ? 1.15 : 1);
            const lean = (r() - .5) * (8 + growth * 16);
            ctx.globalAlpha = (.15 + r() * .17) * (.55 + growth * .75);
            ctx.strokeStyle = ['#6eaa61', '#7eb362', '#588e5a', '#649f77', '#8abe77'][Math.floor(r() * 5)];
            ctx.lineWidth = .8 + r() * 1.4;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + lean * .35, y - h * .52, x + lean, y - h);
            ctx.stroke();
        }
    }
    // Feathered watercolor shadows to keep the soil integrated with the rest of the painting.
    for (let i = 0; i < 110; i++) {
        const x = 120 + r() * 840, y = r() * 1024, rx = 16 + r() * 42, ry = 8 + r() * 20;
        ctx.globalAlpha = .04 + r() * .06;
        ctx.fillStyle = ['#80b39e', '#7aa5a0', '#94c5a4'][Math.floor(r() * 3)];
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function makeWoodTexture(seed = 88) {
    const r = random(seed), c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 512, 512);
    g.addColorStop(0, '#c79c73');
    g.addColorStop(.5, '#9d6f4f');
    g.addColorStop(1, '#734d34');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 40; i++) {
        const y = i * 14 + r() * 8;
        ctx.strokeStyle = `rgba(${90 + Math.floor(r() * 50)},${50 + Math.floor(r() * 30)},${20 + Math.floor(r() * 20)},${0.14 + r() * 0.12})`;
        ctx.lineWidth = 2 + r() * 3;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= 512; x += 32)
            ctx.quadraticCurveTo(x + 16, y + (r() - .5) * 12, x + 32, y + (r() - .5) * 8);
        ctx.stroke();
    }
    for (let i = 0; i < 20; i++) {
        const x = 40 + r() * 430, y = 20 + r() * 470;
        ctx.strokeStyle = 'rgba(70,42,22,0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y, 8 + r() * 18, 4 + r() * 10, r() * Math.PI, 0, Math.PI * 2);
        ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function makeSkyTexture(seed = 2026) {
    const r = random(seed), c = document.createElement('canvas');
    c.width = 1024;
    c.height = 768;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 768);
    g.addColorStop(0, '#c4e0f6');
    g.addColorStop(.42, '#afd3ee');
    g.addColorStop(.72, '#99c6ea');
    g.addColorStop(1, '#8dbce5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 768);
    for (let i = 0; i < 42; i++) {
        const x = r() * 1024, y = 40 + r() * 460, w = 120 + r() * 240, h = 46 + r() * 120;
        ctx.globalAlpha = .09 + r() * .08;
        ctx.fillStyle = ['#f6f5e9', '#eef4f6', '#ffffff', '#f3edd4', '#d7e7f3'][Math.floor(r() * 5)];
        ctx.beginPath();
        ctx.ellipse(x, y, w, h, r() * .35, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x - w * .18, y + h * .02, w * .74, h * .72, r() * .25, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + w * .16, y - h * .05, w * .68, h * .64, r() * .25, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = .05;
    for (let i = 0; i < 120; i++) {
        ctx.fillStyle = ['#d3e6f6', '#bed8ec', '#f8f3dd', '#ffffff'][Math.floor(r() * 4)];
        ctx.beginPath();
        ctx.ellipse(r() * 1024, r() * 580, 35 + r() * 110, 12 + r() * 38, r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function riverHalfWidth(t) {
    const bankEase = Math.sin(t * Math.PI) * 0.6;
    return 6.95 * (0.98 + bankEase * 0.14);
}
function buildRiverGeometry(length = 255, rows = 200, front = 22) {
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= rows; i++) {
        const t = i / rows;
        const z = front - t * (length + front);
        const cx = riverX(z);
        const half = riverHalfWidth(t) + 0.18;
        positions.push(cx - half, -0.055, z, cx + half, -0.055, z);
        uvs.push(0, t, 1, t);
    }
    for (let i = 0; i < rows; i++) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}
const FALL_Z = 8 - (STOPS[4] - .019) * 228;
const FALL_DEPTH = 1.92;
function riverFallAmount(z){
  // Desnível localizado: nível alto antes da cachoeira, baixo depois.
  // Em nenhum ponto o rio (e portanto o barco) sobe durante o avanço.
  return smooth(clamp((FALL_Z + 1.05 - z) / 2.10, 0, 1));
}
function makeScene(host, onProgress, onSceneReady){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#b9dff7');scene.fog=new THREE.FogExp2('#d4ebfb',.0092);
  const camera=new THREE.PerspectiveCamera(67,1,.12,360);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  const mobileDevice=window.matchMedia('(max-width: 720px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,mobileDevice?1.25:1.65));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.23;
  host.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight('#f5fbff','#4a8fa2',2.5));
  const sun=new THREE.DirectionalLight('#f7f8ff',1.55);sun.position.set(-25,44,-95);scene.add(sun);
  const rng=random(1729), colors=['#5eaa8f','#7bba91','#2f817d','#227879','#a4c88d','#3a9989','#6cabaf','#bdd7a7'];
  const grassTexture=makeGrassTexture(303); grassTexture.wrapS=grassTexture.wrapT=THREE.RepeatWrapping; grassTexture.repeat.set(.7,.48);
  grassTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const woodTexture=makeWoodTexture(909); woodTexture.wrapS=woodTexture.wrapT=THREE.RepeatWrapping; woodTexture.repeat.set(1.2,3.2);
  const treeAssetURLs=[asset('tree-main-01.webp'),asset('tree-main-02.webp'),asset('tree-03.webp'),asset('tree-04.webp')];
  // Usa apenas artes de moitas/arbustos nas margens. O arquivo grass-01 é uma árvore,
  // então ele não pode ser usado na faixa beira-rio.
  const grassAssetURLs=[asset('bush-trimmed-01.webp'),asset('bush-trimmed-02.webp')];
  const localTreeTextures=[
    makeTreeTexture(201,['#d8eef6','#8fcbe0','#5caec3','#0d7884'],1),
    makeTreeTexture(777,['#e6f6fb','#abd9ea','#79bfd3','#2a8da6'],2),
    makeTreeTexture(512,['#d0eef8','#94d7d8','#4aa7a8','#1c7d85'],1),
    makeTreeTexture(915,['#d8f3fb','#9bcdd7','#5ab8b1','#307e82'],2),
  ];
  // Quatro pinturas-base, cada uma com quatro variações artesanais de cor e orientação.
  // Evita repetições em fileiras sem trocar a identidade de aquarela das ilustrações.
  const treeMats=Array.from({length:16},(_,index)=>new THREE.MeshBasicMaterial({
    map:localTreeTextures[Math.floor(index/4)],transparent:true,alphaTest:.05,
    depthWrite:true,side:THREE.DoubleSide,opacity:.96,
    color:new THREE.Color(['#ffffff','#eef6ec','#f4f0d9','#e4f3f0'][index%4])
  }));
  const derivedTreeTextures=[];
  function treeVariantTexture(image,variant){
    const c=document.createElement('canvas');c.width=768;c.height=1024;
    const ctx=c.getContext('2d');
    const filters=['none','hue-rotate(-12deg) saturate(0.93)','hue-rotate(13deg) saturate(1.09)','hue-rotate(24deg) brightness(.94)'];
    ctx.filter=filters[variant];
    if(variant===1||variant===3){ctx.translate(c.width,0);ctx.scale(-1,1);}
    ctx.drawImage(image,0,0,c.width,c.height);ctx.filter='none';
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    derivedTreeTextures.push(t);return t;
  }
  const localBushTextures=[
    makeFoliageTexture(431,['#dff3ea','#c6ead9','#b8e6d4','#9fd8bd','#8ac8af','#6db29f']),
    makeFoliageTexture(913,['#ecf7e8','#d3efcf','#c0e4c2','#a8d6b1','#8cc3a1','#74af92'])
  ];
  const grassMats=[
    new THREE.MeshBasicMaterial({map:localBushTextures[0],transparent:true,alphaTest:.10,depthWrite:true,side:THREE.DoubleSide,opacity:1,color:'#ffffff'}),
    new THREE.MeshBasicMaterial({map:localBushTextures[1],transparent:true,alphaTest:.10,depthWrite:true,side:THREE.DoubleSide,opacity:1,color:'#f4f8f0'}),
    new THREE.MeshBasicMaterial({map:localBushTextures[0],transparent:true,alphaTest:.10,depthWrite:true,side:THREE.DoubleSide,opacity:1,color:'#f6fbf7'}),
    new THREE.MeshBasicMaterial({map:localBushTextures[1],transparent:true,alphaTest:.10,depthWrite:true,side:THREE.DoubleSide,opacity:1,color:'#eef7f4'}),
  ];
  const assetLoader=new THREE.TextureLoader();
  treeAssetURLs.forEach((url,i)=>assetLoader.load(url,t=>{
    t.colorSpace=THREE.SRGBColorSpace;
    for(let variant=0;variant<4;variant++){
      treeMats[i*4+variant].map=treeVariantTexture(t.image,variant);
      treeMats[i*4+variant].needsUpdate=true;
    }
    t.dispose();
  },undefined,()=>console.warn('Falha ao carregar textura de árvore:',url)));
  grassAssetURLs.forEach((url,i)=>assetLoader.load(url,t=>{
    t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    // Cada arte gera duas leituras ligeiramente diferentes para quebrar repetição.
    const base=i*2;
    [base,base+1].forEach((targetIndex,variantOffset)=>{
      if(!grassMats[targetIndex]) return;
      grassMats[targetIndex].map=t;
      grassMats[targetIndex].rotation=variantOffset?Math.PI:0;
      grassMats[targetIndex].needsUpdate=true;
    });
  },undefined,()=>console.warn('Falha ao carregar textura de gramado:',url)));
  // As DUAS folhas originais do autor. Nenhuma folha é gerada artificialmente.
  const leafURLs=[asset('leaf-1.png'),asset('leaf-2.png')];
  const leafMaterials=leafURLs.map(() => new THREE.MeshBasicMaterial({
    transparent:true,alphaTest:.03,depthWrite:false,side:THREE.DoubleSide,
    opacity:.68,color:'#ffffff',toneMapped:false
  }));
  leafURLs.forEach((url,index)=>assetLoader.load(url, texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    leafMaterials[index].map=texture;
    leafMaterials[index].needsUpdate=true;
  }));
  const foliageGeo=new THREE.PlaneGeometry(12,12);
  const riverLength=255;
  // A single height function is used by BOTH ground mesh and vegetation anchors.
  // This prevents trees and bushes appearing suspended above or buried in the banks.
  function groundY(distanceFromCenter,z){
    const bank=riverHalfWidth(clamp((24-z)/(riverLength+24),0,1));
    const d=Math.max(0,distanceFromCenter-bank);
    const rise=0.018*d+0.00039*d*d;
    return -.095+rise+Math.sin(z*.055+distanceFromCenter*.11)*.065*Math.min(1,d/12)-FALL_DEPTH*riverFallAmount(z);
  }
  function groundMesh(side){
    const vertices=[],uvs=[],indices=[],depths=[0,4,10,18,28,42,58,78];
    const rowCount=140,front=24;
    for(let i=0;i<=rowCount;i++){
      const z=front-i*(riverLength+front)/rowCount;
      const t=i/rowCount,cx=riverX(z),bank=riverHalfWidth(t)+.035;
      for(let j=0;j<depths.length;j++){
        const distance=bank+depths[j];
        vertices.push(cx+side*distance,groundY(distance,z),z);
        uvs.push((depths[j]/78)*6,i/rowCount*18);
      }
    }
    for(let i=0;i<rowCount;i++)for(let j=0;j<depths.length-1;j++){
      const a=i*depths.length+j,b=a+depths.length;
      indices.push(a,a+1,b,a+1,b+1,b);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
    return new THREE.Mesh(geo,new THREE.MeshLambertMaterial({map:grassTexture,color:side<0?'#eef8ef':'#edf7ee',side:THREE.DoubleSide}));
  }
  scene.add(groundMesh(-1),groundMesh(1));
  const waterGeo=buildRiverGeometry(riverLength,440,24);
  // A própria malha do rio desce: não é um retângulo branco desenhado sobre a água.
  const waterPositions=waterGeo.attributes.position;
  // A própria superfície navegável acompanha a cachoeira do rio.
  // A altura é invariável em todos os outros trechos (antes e depois).
  for(let i=0;i<waterPositions.count;i++){
    const z=waterPositions.getZ(i);
    waterPositions.setY(i,waterPositions.getY(i)-FALL_DEPTH*riverFallAmount(z));
  }
  waterPositions.needsUpdate=true;
  waterGeo.computeVertexNormals();
  const waterMat=new THREE.ShaderMaterial({transparent:false,side:THREE.DoubleSide,
    uniforms:{uTime:{value:0},uWake:{value:0}},
    vertexShader:`uniform float uTime; varying vec2 vUv; varying vec3 vPos;
      void main(){ vUv=uv; vec3 p=position;
        p.y+=sin(p.z*.49-uTime*.85+p.x*.43)*.012 + sin(p.z*1.3-uTime*1.1)*.006;
        vPos=p; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader:`uniform float uTime;uniform float uWake; varying vec2 vUv; varying vec3 vPos;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
      void main(){
        float shore=pow(abs(vUv.x-.5)*2.,1.65);
        float center=1.-shore;
        vec2 uv=vec2(vPos.x*.17,vPos.z*.12-uTime*.083);
        float n=noise(uv*2.3)+.5*noise(uv*5.4+vec2(uTime*.06,0.));
        float longWave=sin(vPos.z*.88-uTime*1.15+sin(vPos.x*.41)*2.2);
        float fineWave=sin(vPos.z*2.9-uTime*2.0+vPos.x*1.5);
        float cloud=noise(vec2(vPos.x*.04,vPos.z*.05)+vec2(.3,uTime*.006));
        float leaves=noise(vec2(vPos.x*.24,vPos.z*.15-uTime*.016));
        vec3 glass=vec3(.37,.73,.73);
        vec3 pale=vec3(.78,.91,.85);
        vec3 deep=vec3(.08,.40,.49);
        vec3 c=mix(glass,pale,clamp(.2+cloud*.55+longWave*.045,0.,1.));
        c=mix(c,deep,shore*(.25+.35*leaves));
        c=mix(c,vec3(.12,.40,.38),smoothstep(.58,.90,leaves)*shore*.26);
        // Long soft highlights read as light reflected on moving water rather than hard stripes.
        float glint=smoothstep(.83,.98,sin(vPos.z*.57-uTime*.82+vPos.x*.39+3.*n)*.5+.5);
        glint*=.15+.35*center;
        float caustics=smoothstep(.76,.98,noise(uv*8.0+fineWave*.13))*.095;
        c+=vec3(.72,.81,.74)*(glint*.38+caustics);
        float wake=exp(-pow(vPos.x-uWake,2.)*.48)*(.5+.5*sin(vPos.z*2.2-uTime*3.2));
        c+=vec3(.09,.12,.10)*wake*.065;
        gl_FragColor=vec4(clamp(c,0.,1.),1.);
      }`
  });
  const waterSurface=new THREE.Mesh(waterGeo,waterMat);
  waterSurface.renderOrder=1;scene.add(waterSurface);
  const billboards=[];
  const treeGeo=new THREE.PlaneGeometry(1,1);
  treeGeo.translate(0,.5,0);
  const grassGeo=new THREE.PlaneGeometry(1,1);
  grassGeo.translate(0,.5,0);
  // Margens em camadas (referência: arbustos na frente, árvores atrás).
  // Todas as distâncias são medidas da BORDA da água, não do eixo do rio.
  // Os núcleos de vegetação são irregulares para não formar fileiras artificiais.
  const floraPlan=[
    // Faixa da margem: moitas distribuídas em profundidades diferentes para não formar blocos iguais.
    {kind:'bush', count:68, edgeMin:.35,edgeMax:4.8,clusters:16, profile:'nearBush'},
    {kind:'bush', count:56, edgeMin:2.0,edgeMax:7.2,clusters:14, profile:'midBush'},
    // Árvores espalhadas em três faixas de profundidade, sempre atrás das moitas.
    {kind:'tree', count:22, edgeMin:7.5,edgeMax:17.5,clusters:9, profile:'frontTree'},
    {kind:'tree', count:20, edgeMin:11.5,edgeMax:23.5,clusters:8, profile:'midTree'},
    {kind:'tree', count:16, edgeMin:16.0,edgeMax:29.0,clusters:7, profile:'backTree'},
    {kind:'tree', count:12, edgeMin:19.5,edgeMax:33.0,clusters:6, profile:'farTree'},
  ];
  const occupied=[];
  const bushProfiles={
    nearBush:[
      {aspectMin:1.08,aspectMax:1.28,hMin:1.12,hMax:1.55,sink:.32,materials:[0,2]},
      {aspectMin:1.18,aspectMax:1.42,hMin:1.28,hMax:1.78,sink:.38,materials:[1,3]},
    ],
    midBush:[
      {aspectMin:1.16,aspectMax:1.38,hMin:1.30,hMax:1.85,sink:.36,materials:[0,3]},
      {aspectMin:1.24,aspectMax:1.52,hMin:1.45,hMax:2.00,sink:.42,materials:[1,2]},
      {aspectMin:1.34,aspectMax:1.64,hMin:1.58,hMax:2.15,sink:.46,materials:[2,3]},
    ]
  };
  const treeProfiles={
    frontTree:{hMin:10.8,hMax:16.8,aspectMin:.70,aspectMax:.86,materials:[0,1]},
    midTree:{hMin:11.6,hMax:18.0,aspectMin:.70,aspectMax:.82,materials:[1,2]},
    backTree:{hMin:12.4,hMax:18.8,aspectMin:.68,aspectMax:.80,materials:[2,3]},
    farTree:{hMin:10.5,hMax:15.8,aspectMin:.64,aspectMax:.76,materials:[0,2,3]},
  };
  // A mesma margem usada na geometria do rio, inclusive nas curvas.
  function bankAt(z){return riverHalfWidth(clamp((24-z)/(riverLength+24),0,1));}
  const clusterCache=new Map();
  function clusterPack(spec){
    const key=`${spec.kind}-${spec.count}-${spec.clusters}-${spec.edgeMin}-${spec.edgeMax}-${spec.profile}`;
    if(clusterCache.has(key)) return clusterCache.get(key);
    const pack=[];
    const zStart=15, zEnd=-252;
    const step=(zStart-zEnd)/Math.max(1,spec.clusters-1);
    let primary=rng()>.5?1:-1;
    for(let c=0;c<spec.clusters;c++){
      if(c>0 && rng()>.55) primary*=-1;
      const secondary=-primary;
      pack.push({
        primarySide:primary,
        secondarySide:secondary,
        secondaryChance:spec.kind==='bush' ? (.30+rng()*.18) : (.22+rng()*.14),
        center:clamp(zStart-c*step + (rng()-.5)*(spec.kind==='tree'?16:10), -252, 18),
        width:(spec.kind==='tree'?10:7) + rng()*(spec.kind==='tree'?13:8),
        edgeBias:.16+rng()*.68,
        edgeSpread:(spec.kind==='tree'?3.2:2.0)+rng()*(spec.kind==='tree'?3.1:2.1)
      });
    }
    clusterCache.set(key,pack);
    return pack;
  }
  function overlaps(kind, side, x, z){
    const minX=kind==='tree'?3.6:1.75;
    const minZ=kind==='tree'?7.2:3.7;
    return occupied.some(o=>o.side===side && Math.abs(o.z-z)<minZ && Math.abs(o.x-x)<minX && (o.kind===kind || kind==='bush' || o.kind==='bush'));
  }
  function spawnBillboard(spec,i){
    const {kind,count,edgeMin,edgeMax,profile}=spec;
    const pack=clusterPack(spec);
    let z,x,offset,edge,side;
    let chosenMaterial, h, width, y;
    for(let attempt=0;attempt<44;attempt++){
      const t=(i + rng()*.85)/count;
      const cluster=pack[Math.min(pack.length-1,Math.floor(t*pack.length))];
      side=rng()<cluster.secondaryChance?cluster.secondarySide:cluster.primarySide;
      z=cluster.center + (rng()-.5)*cluster.width + (rng()-.5)*(kind==='tree'?8.4:4.8);
      z=clamp(z,-254,19);
      edge=THREE.MathUtils.lerp(edgeMin,edgeMax,clamp(cluster.edgeBias + Math.sin(z*.041+side*1.3)*.12 + (rng()-.5)*.18,0,1));
      edge+=(rng()-.5)*cluster.edgeSpread;
      if(kind==='tree') edge+=.8;
      edge=clamp(edge,edgeMin,edgeMax);
      offset=bankAt(z)+edge;
      x=riverX(z)+side*offset;
      if(overlaps(kind,side,x,z)) continue;
      if(kind==='bush'){
        const bucket=bushProfiles[profile][Math.floor(rng()*bushProfiles[profile].length)];
        h=bucket.hMin+rng()*(bucket.hMax-bucket.hMin);
        const aspect=bucket.aspectMin+rng()*(bucket.aspectMax-bucket.aspectMin);
        width=h*aspect*(0.94+rng()*.16)*(rng()>.5?-1:1);
        chosenMaterial=grassMats[bucket.materials[Math.floor(rng()*bucket.materials.length)]];
        y=groundY(offset,z)-bucket.sink-h*.055 + (rng()-.5)*.02;
      } else {
        const bucket=treeProfiles[profile];
        h=bucket.hMin+rng()*(bucket.hMax-bucket.hMin);
        const aspect=bucket.aspectMin+rng()*(bucket.aspectMax-bucket.aspectMin);
        width=h*aspect*(0.86+rng()*.22)*(rng()>.56?-1:1);
        chosenMaterial=treeMats[bucket.materials[Math.floor(rng()*bucket.materials.length)]*4+Math.floor(rng()*4)];
        y=groundY(offset,z)-.08 + (rng()-.5)*.05;
      }
      break;
    }
    if(chosenMaterial===undefined){
      side = side || -1;
      z = z ?? 0;
      edge = edge ?? edgeMin;
      offset = bankAt(z)+edge;
      x = x ?? (riverX(z)+side*offset);
      if(kind==='bush'){
        const bucket=bushProfiles[profile][0];
        h = h ?? ((bucket.hMin+bucket.hMax)*.5);
        const aspect=(bucket.aspectMin+bucket.aspectMax)*.5;
        width = width ?? (h*aspect*(side>0?-1:1));
        chosenMaterial = grassMats[bucket.materials[0]];
        y = y ?? (groundY(offset,z)-bucket.sink-h*.055);
      } else {
        const bucket=treeProfiles[profile];
        h = h ?? ((bucket.hMin+bucket.hMax)*.5);
        const aspect=(bucket.aspectMin+bucket.aspectMax)*.5;
        width = width ?? (h*aspect*(side>0?-1:1));
        chosenMaterial = treeMats[bucket.materials[0]*4];
        y = y ?? (groundY(offset,z)-.08);
      }
    }
    occupied.push({x,z,side,kind});
    const mesh=new THREE.Mesh(kind==='tree'?treeGeo:grassGeo,chosenMaterial);
    mesh.position.set(x,y,z);
    mesh.scale.set(width,h,1);
    if(kind==='tree') mesh.userData.windLean=(rng()-.5)*.06;
    mesh.userData.billboard=true;
    scene.add(mesh);billboards.push(mesh);
  }
  floraPlan.forEach(spec=>{for(let i=0;i<spec.count;i++)spawnBillboard(spec,i);});
  function placeBillboard({kind='tree',side=-1,z=-10,edge=8,height=10,aspect=.75,materialIndex=0,widthJitter=1,yJitter=0,flip=false,sink=.38}){
    const offset=bankAt(z)+edge;
    const x=riverX(z)+side*offset;
    const chosenMaterial=kind==='tree'
      ? treeMats[(materialIndex%4)*4+Math.floor(rng()*4)]
      : grassMats[Math.max(0,Math.min(grassMats.length-1,materialIndex))];
    const mesh=new THREE.Mesh(kind==='tree'?treeGeo:grassGeo,chosenMaterial);
    const width=height*aspect*widthJitter*(flip?-1:1);
    mesh.position.set(x,groundY(offset,z)-(kind==='bush'?sink+height*.055:.08)+yJitter,z);
    mesh.scale.set(width,height,1);
    mesh.userData.billboard=true;
    if(kind==='tree') mesh.userData.windLean=(rng()-.5)*.055;
    scene.add(mesh);billboards.push(mesh);occupied.push({x,z,side,kind});
    return mesh;
  }
  // Entrada mais densa, mas com variação e espaçamento para evitar blocos repetidos.
  [
    {kind:'tree',side:-1,z:16,edge:21,height:18.8,aspect:.82,materialIndex:0,widthJitter:1.08,flip:true,yJitter:.02},
    {kind:'tree',side:-1,z:9,edge:17.5,height:14.0,aspect:.77,materialIndex:1,widthJitter:.90},
    {kind:'tree',side:-1,z:1,edge:14.5,height:10.4,aspect:.72,materialIndex:2,widthJitter:.84},
    {kind:'tree',side:1,z:15,edge:20.8,height:17.4,aspect:.81,materialIndex:0,widthJitter:1.00},
    {kind:'tree',side:1,z:8,edge:17.8,height:14.9,aspect:.77,materialIndex:1,widthJitter:.94,flip:true},
    {kind:'tree',side:1,z:0,edge:24.2,height:11.9,aspect:.70,materialIndex:3,widthJitter:.82},
    {kind:'bush',side:-1,z:14,edge:4.2,height:1.7,aspect:1.36,materialIndex:2,widthJitter:1.04,sink:.40},
    {kind:'bush',side:-1,z:7,edge:3.5,height:1.55,aspect:1.28,materialIndex:1,widthJitter:.98,sink:.36},
    {kind:'bush',side:-1,z:-1,edge:4.6,height:1.85,aspect:1.42,materialIndex:3,widthJitter:1.08,sink:.44,flip:true},
    {kind:'bush',side:1,z:13,edge:4.0,height:1.6,aspect:1.30,materialIndex:0,widthJitter:1.02,sink:.38},
    {kind:'bush',side:1,z:6,edge:4.8,height:1.8,aspect:1.46,materialIndex:3,widthJitter:1.06,sink:.43},
    {kind:'bush',side:1,z:-2,edge:5.1,height:1.65,aspect:1.34,materialIndex:2,widthJitter:.96,sink:.39,flip:true},
  ].forEach(placeBillboard);
  // Segunda camada espaçada, com menos elementos e intervalos maiores para quebrar repetição.
  const edgeRng=random(80912);
  for(let side of [-1,1]){
    for(let j=0;j<18;j++){
      if(edgeRng()<.25) continue;
      const z=14-j*12.8+(edgeRng()-.5)*7.2;
      const edge=11.5+edgeRng()*14.5;
      placeBillboard({kind:'tree',side,z,edge,height:10.5+edgeRng()*6.2,aspect:.68+edgeRng()*.10,materialIndex:Math.floor(edgeRng()*4),widthJitter:.86+edgeRng()*.16,flip:edgeRng()>.52});
    }
  }
  // Preenchimento pontual das áreas que ainda ficavam muito abertas.
  [
    // margem esquerda
    {kind:'tree',side:-1,z:-18,edge:13.8,height:11.4,aspect:.72,materialIndex:1,widthJitter:.88},
    {kind:'tree',side:-1,z:-52,edge:16.8,height:10.2,aspect:.68,materialIndex:2,widthJitter:.84,flip:true},
    {kind:'tree',side:-1,z:-96,edge:18.8,height:9.8,aspect:.67,materialIndex:0,widthJitter:.82},
    {kind:'bush',side:-1,z:-22,edge:4.4,height:1.72,aspect:1.36,materialIndex:2,widthJitter:1.02,sink:.40},
    {kind:'bush',side:-1,z:-42,edge:5.0,height:1.92,aspect:1.44,materialIndex:3,widthJitter:1.06,sink:.44},
    {kind:'bush',side:-1,z:-64,edge:3.6,height:1.46,aspect:1.30,materialIndex:1,widthJitter:.96,sink:.37},
    {kind:'bush',side:-1,z:-86,edge:5.2,height:1.80,aspect:1.40,materialIndex:0,widthJitter:1.08,sink:.41,flip:true},
    {kind:'bush',side:-1,z:-122,edge:4.6,height:1.62,aspect:1.34,materialIndex:2,widthJitter:1.00,sink:.39},
    // margem direita
    {kind:'tree',side:1,z:-10,edge:14.5,height:11.2,aspect:.70,materialIndex:3,widthJitter:.86,flip:true},
    {kind:'tree',side:1,z:-46,edge:17.2,height:10.6,aspect:.69,materialIndex:1,widthJitter:.84},
    {kind:'tree',side:1,z:-78,edge:15.2,height:9.9,aspect:.67,materialIndex:0,widthJitter:.80},
    {kind:'tree',side:1,z:-116,edge:20.4,height:10.8,aspect:.70,materialIndex:2,widthJitter:.86,flip:true},
    {kind:'bush',side:1,z:-18,edge:4.8,height:1.84,aspect:1.44,materialIndex:1,widthJitter:1.06,sink:.43},
    {kind:'bush',side:1,z:-38,edge:3.8,height:1.52,aspect:1.28,materialIndex:0,widthJitter:.98,sink:.37},
    {kind:'bush',side:1,z:-58,edge:5.3,height:1.88,aspect:1.46,materialIndex:3,widthJitter:1.08,sink:.44,flip:true},
    {kind:'bush',side:1,z:-90,edge:4.2,height:1.58,aspect:1.32,materialIndex:2,widthJitter:1.00,sink:.39},
    {kind:'bush',side:1,z:-132,edge:5.6,height:1.96,aspect:1.48,materialIndex:1,widthJitter:1.10,sink:.45},
    // miolo distante, pequenos pontos para o horizonte não ficar tão vazio
    {kind:'bush',side:-1,z:-154,edge:4.0,height:1.36,aspect:1.24,materialIndex:0,widthJitter:.94,sink:.34},
    {kind:'bush',side:1,z:-166,edge:4.4,height:1.42,aspect:1.26,materialIndex:2,widthJitter:.96,sink:.35},
    {kind:'tree',side:-1,z:-178,edge:15.8,height:8.8,aspect:.64,materialIndex:1,widthJitter:.76},
    {kind:'tree',side:1,z:-188,edge:16.6,height:8.6,aspect:.64,materialIndex:3,widthJitter:.74,flip:true},
  ].forEach(placeBillboard);
  // Camadas ilustradas separadas: píer na margem esquerda e montanhas no horizonte.
  // Alpha PNG: não incluem céu nem retângulos de fundo.
  const scenicLayers=[];
  function scenicBillboard(url,position,width,height,opacity=1){
    const mat=new THREE.MeshBasicMaterial({transparent:true,alphaTest:.025,depthWrite:false,side:THREE.DoubleSide,opacity,color:'#ffffff'});
    const geo=new THREE.PlaneGeometry(width,height);
    const mesh=new THREE.Mesh(geo,mat);
    mesh.position.set(...position);mesh.renderOrder=2;
    assetLoader.load(url,t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());mat.map=t;mat.needsUpdate=true;});
    scene.add(mesh);scenicLayers.push(mesh);return mesh;
  }
  // Píer APOIADO na margem: a referência do nível d'água deve ser os pés dos
  // pilares (cerca de 62% da altura da arte), NÃO o limite da mancha de água
  // pintada ao redor (74%). Isso elimina o aspecto de estrutura suspensa.
  const pierZ=-31, pierSide=-1;
  const pierWidth=8.8, pierHeight=6.6;
  const pierOffset=bankAt(pierZ)+0.20; // conexão física com o gramado
  const pierX=riverX(pierZ)+pierSide*pierOffset;
  const pierWaterlineFromTop=0.62;
  const pierWaterY=-0.055; // nível da geometria real do rio
  const pierY=pierWaterY+(pierWaterlineFromTop-.5)*pierHeight;
  const pier=scenicBillboard(asset('pier-watercolor.webp'),[pierX,pierY,pierZ],pierWidth,pierHeight);
  pier.userData.faceCamera=true;
  // Montanhas no plano mais distante, atrás da mata, sem background recortado.
  const farZ=-286;
  const mountain=scenicBillboard(asset('mountains-watercolor.webp'),[riverX(farZ),18.5,farZ],146,48,.85);
  mountain.renderOrder=0;
  mountain.userData.faceCamera=true;
  // Pop-ups físicos 3D plantados no mundo nas posições das paradas.
  // Ficam de pé no local da história e NÃO acompanham o barco/câmera.
  // Erguem-se do chão (quase planos) até a vertical quando a leitura da parada começa.
  // Toda a folha (e não só o pivô) precisa ficar sobre a terra.
  // Considera a largura da imagem, o giro 3D, a dobra no chão e as curvas do rio.
  function popupGrassAnchor(z,side,width,height){
    // Somente a dobradiça e o comprimento da folha varrem o eixo Z.
    // Um alcance exagerado afastava toda a figura do rio e a deixava minúscula.
    const reach=height+1.2;
    let extreme=side>0?-Infinity:Infinity;
    for(let step=0;step<=40;step++){
      const testZ=z-reach+step*(reach+1.2)/40;
      const shoreline=riverX(testZ)+side*(bankAt(testZ)+.35);
      extreme=side>0?Math.max(extreme,shoreline):Math.min(extreme,shoreline);
    }
    // Margem de segurança adicional além da metade da folha aberta.
    const x=extreme+side*(width*.5+2.5);
    const distance=Math.abs(x-riverX(z));
    return {x,baseY:groundY(distance,z)-(mobileDevice ? .74 : .64)};
  }
  // Cada pop-up e um elemento permanente do mundo, com uma ancora independente.
  // Apos a criacao, anchor.position/anchor.rotation nao sao alterados pelo passeio.
  // Apenas a folha filha rotaciona em seu proprio eixo X para abrir e fechar.
  const storyPopups=[];
  const storyGeo=new THREE.PlaneGeometry(1,1);
  storyGeo.translate(0,.5,0); // dobradica exatamente na base da folha
  const storyAspects=[1.6,2048/1258,2048/1185,1.6,1.6,1.6];
  STORY_IMAGES.forEach((chapterScene,index)=>{
    const stopZ=8-chapterScene.at*228;
    // Distancia constante em relacao ao marco de leitura, NAO a camera em movimento.
    const z=stopZ-(mobileDevice?42:22);
    const side=chapterScene.side==='right'?1:-1;
    const height=mobileDevice?Math.min(18.5,Math.max(15.3,29*(window.innerWidth/window.innerHeight))):23.8;
    const width=height*storyAspects[index];
    const grassAnchor=popupGrassAnchor(z,side,width,height);

    const anchor=new THREE.Group();
    anchor.name=`pop-up-marco-fixo-${index+1}`;
    anchor.position.set(grassAnchor.x,grassAnchor.baseY,z);
    anchor.rotation.y=side>0 ? -0.08 : 0.08; // orientacao inicial, permanente
    scene.add(anchor); // objeto do MUNDO, nunca filho do barco ou camera

    // A arte pop-up sempre fica À FRENTE da vegetação: não há corte
    // causado pelas árvores, embora a âncora continue fixa no gramado.
    const mat=new THREE.MeshBasicMaterial({
      transparent:true,alphaTest:.08,depthTest:false,depthWrite:false,
      side:THREE.DoubleSide,opacity:1,color:'#ffffff'
    });
    const leaf=new THREE.Mesh(storyGeo,mat);
    leaf.name=`folha-articulada-${index+1}`;
    leaf.scale.set(width,height,1);
    leaf.rotation.x=-Math.PI*.5;
    leaf.position.set(0,0,0);
    leaf.visible=false;
    // Renderizada depois de toda a mata, preservando cada pixel da aquarela.
    // Não alterar a posição/rotação da âncora enquanto o barco se movimenta.
    leaf.renderOrder=40;
    anchor.add(leaf);
    storyPopups.push(leaf);
    assetLoader.load(chapterScene.src,texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      // Remove apenas o contorno retangular das margens, sem cortar o conteúdo.
      // A textura é estável: o levantamento nunca usa fade.
      mat.map=softenedWatercolorTexture(THREE,texture);mat.needsUpdate=true;
    },undefined,()=>console.warn('Falha ao carregar ilustração de parada:',chapterScene.src));
  });
  // V24: QUEDA DO PRÓPRIO RIO — exatamente ENTRE a quarta e quinta parada.
  // A água, as duas margens e a câmera atravessam o MESMO desnível.
  // A proa a01 (overlay) não oscila nos demais trechos; durante a cascata,
  // o observador acompanha a descida do rio de modo sincronizado.
  const cascadeZ=FALL_Z;
  const cascade=new THREE.Group();
  cascade.position.set(riverX(cascadeZ),0,cascadeZ);
  const waterfallWidth=riverHalfWidth(clamp((24-cascadeZ)/(riverLength+24),0,1))*2+.75;
  const cascadeAheadX=riverX(cascadeZ-10);
  const cascadeHeading=Math.atan2(-(cascadeAheadX-riverX(cascadeZ)),10);
  cascade.rotation.y=cascadeHeading;
  const waterfallResources=[];
  const waterfallMotion={value:0};
  const cascadeRng=random(42109);

  // Cortina em perspectiva com camadas em diferentes profundidades,
  // correntes verticais irregulares e bordas orgânicas que acompanham o rio.
  const waterfallMat=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uTime:waterfallMotion,uTint:{value:new THREE.Color('#d7f9f6')},uOpacity:{value:1}},
    vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float uTime;uniform vec3 uTint;uniform float uOpacity;varying vec2 vUv;
      void main(){
        float streams=.5+.5*sin(vUv.x*76.0+sin(vUv.x*26.0)*2.2+vUv.y*5.);
        float threads=.5+.5*sin(vUv.x*164.0-vUv.y*18.0+uTime*2.7);
        float falling=.5+.5*sin(vUv.y*46.0+uTime*10.0+vUv.x*13.0);
        float edges=smoothstep(.0,.065,vUv.x)*(1.0-smoothstep(.935,1.0,vUv.x));
        float eddies=.5+.5*sin(vUv.x*31.+vUv.y*22.-uTime*2.);
        vec3 turquoise=vec3(.25,.61,.68);
        vec3 pearl=vec3(.82,.98,.96);
        vec3 color=mix(turquoise,pearl,.40+.32*streams+.15*threads);
        color=mix(color,uTint,.22);
        color+=vec3(.07,.10,.09)*falling*eddies;
        float alpha=(.40+.21*streams+.14*threads+.09*falling)*edges*uOpacity;
        gl_FragColor=vec4(color,alpha);
      }`
  });
  waterfallResources.push(waterfallMat);
  // Sombras sob os filetes: a queda possui profundidade, e não uma parede azul.
  const backingMat=new THREE.MeshBasicMaterial({color:'#306c78',transparent:true,opacity:.46,side:THREE.DoubleSide,depthWrite:false});
  waterfallResources.push(backingMat);
  function curtainGeometry(zShift,lowerFraction=1){
    const columns=46, rows=28,positions=[],uvs=[],indices=[];
    for(let j=0;j<=rows;j++){
      const frac=j/rows, y=-.055-frac*FALL_DEPTH*lowerFraction;
      for(let i=0;i<=columns;i++){
        const u=i/columns,x=(u-.5)*waterfallWidth;
        const curved=-.26*(Math.abs(u-.5)*2)**2;
        const wave=Math.sin(u*23+frac*7.5)*.055 + Math.sin(u*53-frac*12)*.022;
        const plunge=-frac*.48;
        positions.push(x,y,zShift+curved+plunge+wave);
        uvs.push(u,1-frac);
        if(i<columns&&j<rows){const a=j*(columns+1)+i;indices.push(a,a+1,a+columns+1,a+1,a+columns+2,a+columns+1);}
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  function apronGeometry(width,length,drop,segments=18){
    const positions=[],uvs=[],indices=[];
    for(let j=0;j<=segments;j++){
      const v=j/segments;
      const z=.98-v*length;
      const y=-.02-v*drop + Math.sin(v*Math.PI)*-.035;
      for(let i=0;i<=1;i++){
        const u=i;
        const x=(u-.5)*width*(.99-.05*v);
        positions.push(x,y,z);
        uvs.push(u,1-v);
        if(i<1 && j<segments){const a=j*2+i;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
      }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    g.setIndex(indices);g.computeVertexNormals();
    return g;
  }

  const backingGeo=curtainGeometry(-.57);
  const backingMesh=new THREE.Mesh(backingGeo,backingMat);backingMesh.renderOrder=1;cascade.add(backingMesh);
  waterfallResources.push(backingGeo);
  // Crista conectada ao leito do rio: menos linha reta, mais transição com a água corrente.
  const crestGeo=new THREE.BoxGeometry(waterfallWidth*.985,.038,.18);
  const crestMat=new THREE.MeshBasicMaterial({color:'#e8fbf6',transparent:true,opacity:.58});
  const crest=new THREE.Mesh(crestGeo,crestMat);
  crest.position.set(0,-.04,.60);
  crest.renderOrder=4;
  cascade.add(crest);
  waterfallResources.push(crestGeo,crestMat);

  const apronGeo=apronGeometry(waterfallWidth*.99,1.12,.22,22);
  const apronMat=new THREE.MeshBasicMaterial({color:'#bfecea',transparent:true,opacity:.74,side:THREE.DoubleSide,depthWrite:false});
  const apron=new THREE.Mesh(apronGeo,apronMat);
  apron.renderOrder=3;
  cascade.add(apron);
  waterfallResources.push(apronGeo,apronMat);

  const lowerApronGeo=apronGeometry(waterfallWidth*.98,1.55,.34,20);
  const lowerApronMat=new THREE.MeshBasicMaterial({color:'#91dadd',transparent:true,opacity:.34,side:THREE.DoubleSide,depthWrite:false});
  const lowerApron=new THREE.Mesh(lowerApronGeo,lowerApronMat);
  lowerApron.position.set(0,-FALL_DEPTH+.18,-.95);
  lowerApron.rotation.x=-.11;
  lowerApron.renderOrder=2;
  cascade.add(lowerApron);
  waterfallResources.push(lowerApronGeo,lowerApronMat);
  for(const [depth,opacity,tint] of [[-.41,.56,'#b3e7e7'],[-.16,.96,'#e3faf4'],[.09,.82,'#a6e4e6'],[.32,.49,'#d5f2f0']]){
    const geo=curtainGeometry(depth),mat=waterfallMat.clone();mat.uniforms.uTime=waterfallMotion;
    mat.uniforms.uOpacity={value:opacity};mat.uniforms.uTint={value:new THREE.Color(tint)};
    waterfallResources.push(geo,mat);
    const mesh=new THREE.Mesh(geo,mat);mesh.renderOrder=2;cascade.add(mesh);
  }

  // Pequenas rochas em ambas as margens, nunca uma barreira no meio do canal.
  const rockColors=['#718c8b','#8fa8a0','#aec0b2','#648483','#88a59d','#b7c5b9'];
  const rockGeo=new THREE.IcosahedronGeometry(1,1);
  const rockMats=rockColors.map(color=>new THREE.MeshLambertMaterial({color,flatShading:true,roughness:1}));
  waterfallResources.push(rockGeo,...rockMats);
  for(const side of [-1,1]){
    for(let i=0;i<18;i++){
      const posX=side*(waterfallWidth*.5+.08+cascadeRng()*1.05);
      const posZ=(cascadeRng()-.5)*5.3;
      const riverY=-FALL_DEPTH*riverFallAmount(cascadeZ+posZ);
      const rock=new THREE.Mesh(rockGeo,rockMats[Math.floor(cascadeRng()*rockMats.length)]);
      rock.position.set(posX,riverY-.10+cascadeRng()*.14,posZ);
      rock.scale.set(.42+cascadeRng()*.55,.28+cascadeRng()*.52,.46+cascadeRng()*.58);
      rock.rotation.set(cascadeRng()*.6,cascadeRng()*1.3,cascadeRng()*.4);
      cascade.add(rock);
    }
  }

  const roundParticleTexture=makeRoundParticleTexture();
  waterfallResources.push(roundParticleTexture);
  // Superfície espumosa radial na crista e abaixo da cascata.
  const foamCanvas=document.createElement('canvas');foamCanvas.width=256;foamCanvas.height=128;
  const foamContext=foamCanvas.getContext('2d');
  const gradient=foamContext.createRadialGradient(128,64,4,128,64,125);
  gradient.addColorStop(0,'rgba(248,255,252,.89)');
  gradient.addColorStop(.26,'rgba(237,254,249,.67)');
  gradient.addColorStop(.69,'rgba(190,240,238,.20)');
  gradient.addColorStop(1,'rgba(190,240,238,0)');
  foamContext.fillStyle=gradient;foamContext.fillRect(0,0,256,128);
  const foamTexture=new THREE.CanvasTexture(foamCanvas);foamTexture.colorSpace=THREE.SRGBColorSpace;
  waterfallResources.push(foamTexture);
  function foamDisk(width,depth,y,z,opacity){
    const geo=new THREE.PlaneGeometry(width,depth),mat=new THREE.MeshBasicMaterial({map:foamTexture,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    const m=new THREE.Mesh(geo,mat);m.rotation.x=-Math.PI/2;m.position.set(0,y,z);m.renderOrder=3;cascade.add(m);waterfallResources.push(geo,mat);return m;
  }
  const foam=foamDisk(waterfallWidth*.985,4.6,-FALL_DEPTH-.03,-1.75,.78);
  const lip=foamDisk(waterfallWidth*.985,1.95,-.042,.48,.62);
  const midFoam=foamDisk(waterfallWidth*.90,1.35,-FALL_DEPTH*.48,-.42,.22);

  // Gotas que descem e arrebentam na piscina inferior, sem mexer na proa.
  const sprayCount=mobileDevice?340:780;
  const dropletPos=[],dropletColor=[],dropletSeeds=[];
  for(let i=0;i<sprayCount;i++){
    const falling=i<sprayCount*.72;
    const x=(cascadeRng()-.5)*waterfallWidth*.98;
    const t=cascadeRng(),z=falling?-.2+cascadeRng()*.5:-.72-cascadeRng()*2.4;
    const y=falling?-.05-t*FALL_DEPTH:-FALL_DEPTH+.03+cascadeRng()*.35;
    dropletPos.push(x,y,z);
    const c=.77+cascadeRng()*.23;dropletColor.push(c,1,c*.97);
    dropletSeeds.push(x,z,t,falling?1:0,cascadeRng());
  }
  const splashGeometry=new THREE.BufferGeometry();
  splashGeometry.setAttribute('position',new THREE.Float32BufferAttribute(dropletPos,3));
  splashGeometry.setAttribute('color',new THREE.Float32BufferAttribute(dropletColor,3));
  const sprayMat=new THREE.PointsMaterial({color:'#f2ffff',vertexColors:true,size:.14,opacity:.87,transparent:true,depthWrite:false,map:roundParticleTexture,alphaTest:.025});
  const spray=new THREE.Points(splashGeometry,sprayMat);spray.renderOrder=4;cascade.add(spray);
  waterfallResources.push(splashGeometry,sprayMat);
  const dropletPositions=splashGeometry.attributes.position;
  function animateWaterfall(time){
    waterfallMotion.value=time;
    for(let i=0;i<sprayCount;i++){
      const a=i*5,b=i*3,t=dropletSeeds[a+2],seed=dropletSeeds[a+4],falling=dropletSeeds[a+3]===1;
      if(falling){
        const phase=(t+time*(.5+seed*.4))%1;
        dropletPositions.array[b]=dropletSeeds[a]+Math.sin(phase*12+seed*8)*.06;
        dropletPositions.array[b+1]=-.05-phase*FALL_DEPTH;
        dropletPositions.array[b+2]=dropletSeeds[a+1]-phase*.5;
      }else{
        dropletPositions.array[b]=dropletSeeds[a]+Math.sin(time*4+seed*17)*.09;
        dropletPositions.array[b+1]=-FALL_DEPTH+.04+((t+time*(.28+seed*.2))%1)*.4;
        dropletPositions.array[b+2]=dropletSeeds[a+1];
      }
    }
    dropletPositions.needsUpdate=true;
  }
  scene.add(cascade);

    // Caboclo de perfil: partículas azuis desenham cocar, rosto e busto com contornos definidos.
  // O material NÃO usa mistura aditiva: preserva o azul saturado, evitando pontos brancos.
  const spiritCount=mobileDevice?7500:13500;
  let spiritReady=false,spiritTarget=null,spiritStart=null,spiritDelays=null,spiritPhases=null,spiritSwirls=null;
  const spiritGeo=new THREE.BufferGeometry();
  spiritGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(spiritCount*3),3));
  spiritGeo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(spiritCount*3),3));
  const spiritMaterial=new THREE.PointsMaterial({size:.13,transparent:true,opacity:0,vertexColors:true,map:roundParticleTexture,alphaTest:.025,
    depthTest:false,depthWrite:false,toneMapped:false,fog:false,blending:THREE.NormalBlending});
  const spirit=new THREE.Points(spiritGeo,spiritMaterial);spirit.frustumCulled=false;spirit.renderOrder=36;
  const spiritImageMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthTest:false,depthWrite:false,
    side:THREE.DoubleSide,toneMapped:false,color:'#ffffff'});
  const spiritImage=new THREE.Mesh(new THREE.PlaneGeometry(12.8,12.8*1253/1246),spiritImageMaterial);
  spiritImage.position.set(0,12.8*1253/1246*.5,-.14);spiritImage.renderOrder=35;
  const spiritGroup=new THREE.Group();spiritGroup.position.set(riverX(-211),7.6,-211);
  spiritGroup.add(spiritImage,spirit);spiritGroup.frustumCulled=false;scene.add(spiritGroup);
  // A imagem fornecida é uma arte de pontos AZUIS com alfa; usar sua forma exata.
  assetLoader.load(asset('caboclo-referencia.webp'),tex=>{
    tex.colorSpace=THREE.SRGBColorSpace;
    tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;
    spiritImageMaterial.map=tex;spiritImageMaterial.needsUpdate=true;
    const data=createCabocloPointCloudData(THREE,random(92017),spiritCount,tex.image);
    spiritTarget=data.targets;spiritStart=data.starts;spiritDelays=data.delays;
    spiritPhases=data.phases;spiritSwirls=data.swirls;
    spiritGeo.attributes.position.array.set(spiritStart);
    spiritGeo.attributes.color.array.set(data.colors);
    spiritGeo.attributes.position.needsUpdate=true;spiritGeo.attributes.color.needsUpdate=true;
    spiritReady=true;
  },undefined,()=>console.warn('Não foi possível carregar o PNG original do Caboclo'));

  // Oitava parada: livro 3D com a capa final enviada.
  const bookGroup=new THREE.Group();
  const bookCoverMaterial=new THREE.MeshBasicMaterial({color:'#dfeae5',toneMapped:false});
  assetLoader.load(asset('capa-final.webp'),t=>{
    t.colorSpace=THREE.SRGBColorSpace;bookCoverMaterial.map=t;bookCoverMaterial.needsUpdate=true;
  });
  const pages=new THREE.Mesh(new THREE.BoxGeometry(5.0,7.3,.5),new THREE.MeshStandardMaterial({color:'#f1eadd',roughness:.86}));
  const cover=new THREE.Mesh(new THREE.PlaneGeometry(5.02,7.32),bookCoverMaterial);
  cover.position.z=.27;
  const spine=new THREE.Mesh(new THREE.BoxGeometry(.25,7.3,.56),new THREE.MeshStandardMaterial({color:'#345c75',roughness:.81}));
  spine.position.x=-2.54;
  bookGroup.add(pages,cover,spine);
  // Posição fixa calculada a partir da direção do barco na última parada.
  // A capa fica realmente CENTRALIZADA no rio quando o texto final surge.
  const lastStopZ=8-CHAPTERS[7].at*228;
  const lastStopX=riverX(lastStopZ);
  const finalHeading=Math.atan2(-(riverX(lastStopZ-10)-lastStopX),10);
  const bookDistance=mobileDevice?19.2:18.7;
  const bookScale=mobileDevice?1.18:1.34;
  const bookX=lastStopX-Math.sin(finalHeading)*bookDistance;
  const bookZ=lastStopZ-Math.cos(finalHeading)*bookDistance;
  // A base do livro termina imediatamente acima da superfície da água.
  const bookFinalY=bookScale*(7.3/2)+.01;
  bookGroup.position.set(bookX,bookFinalY,bookZ);
  bookGroup.rotation.y=finalHeading+.03;
  bookGroup.scale.setScalar(bookScale);
  bookGroup.visible=false;
  scene.add(bookGroup);
  // Infinite seamless skydome: no cut-out rectangular sky/background image.
  const sky=new THREE.Mesh(new THREE.SphereGeometry(330,32,20),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,fog:false,
    vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vDirection;void main(){
      float y=normalize(vDirection).y;
      float t=smoothstep(-.12,.86,y);
      vec3 horizon=vec3(.91,.92,.84),blue=vec3(.53,.75,.86),zenith=vec3(.49,.69,.82);
      vec3 c=mix(horizon,blue,smoothstep(-.15,.37,y));c=mix(c,zenith,smoothstep(.32,.95,y)*.62);
      float cloud=sin(vDirection.x*.027+sin(vDirection.z*.017)*2.)*sin(vDirection.z*.022);
      c=mix(c,vec3(.96,.96,.91),smoothstep(.43,.90,cloud)*.22*max(0.,t));
      gl_FragColor=vec4(c,1.);
    }`
  }));sky.renderOrder=-10;scene.add(sky);
  // Soft watercolor dust drifting over the river.
  const particleCount=mobileDevice?95:180, pp=new Float32Array(particleCount*3);
  for(let i=0;i<particleCount;i++){pp[i*3]=(rng()-.5)*38;pp[i*3+1]=1+rng()*22;pp[i*3+2]=12-rng()*230;}
  const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pp,3));
  const particles=new THREE.Points(pg,new THREE.PointsMaterial({color:'#f7fff0',size:.16,transparent:true,opacity:.62,depthWrite:false,map:roundParticleTexture,alphaTest:.025})); particles.renderOrder=3; scene.add(particles);
  // Folhas delicadas próximas às copas: quedas lentas e independentes.
  // Duas formas, tamanhos, oscilações e momentos de nascimento diferentes.
  const leafGeo=new THREE.PlaneGeometry(1,1);
  const leafCount=mobileDevice?34:62;
  const leafGroup=new THREE.Group();
  const leaves=[];
  for(let i=0;i<leafCount;i++){
    const material=leafMaterials[i%2];
    const mesh=new THREE.Mesh(leafGeo,material);
    mesh.renderOrder=5;
    const side=rng()<.5?-1:1;
    const leaf={mesh,kind:i%2,side,
      bankOffset:side*(6.5+rng()*8.5),
      startY:5.4+rng()*7.8,
      baseZ:-rng()*110,
      period:8+rng()*10,
      offset:rng(),
      sway:rng()*Math.PI*2,
      oscillate:.55+rng()*.75,
      drift:.12+rng()*.32,
      spiral:(rng()-.5)*.9,
      width:.16+rng()*.17,
      height:.25+rng()*.32,
    };
    mesh.scale.set(leaf.width,leaf.height,1);
    leafGroup.add(mesh);leaves.push(leaf);
  }
  scene.add(leafGroup);
  // A proa é uma imagem frontal independente. Navegação ocorre no plano X/Z.
  // A posição Y do barco é constante na água: não há balanço ou salto vertical.
  scene.add(camera);
  let w=0,h=0,progress=0,elapsed=0,lookX=0,lookY=0,lookTargetX=0,lookTargetY=0,disposed=false,lastReport=0,started=false;
  // A direção altera somente a posição no rio (eixos X/Z), nunca a altura.
  // O deslocamento lateral é limitado para o barco permanecer entre as margens.
  let lateralPosition=0, lateralTarget=0;
  const MAX_LATERAL_METERS=2.45;
  const BOAT_OVERLAY_RANGE_PX=18;
  const clock=new THREE.Clock();
  // Respingos visuais aparecem apenas durante a única cachoeira do passeio.
  // A camada não intercepta gestos nem altera a navegação.
  const waterfallSplash=document.createElement('div');
  waterfallSplash.className='waterfall-ride-splash';
  waterfallSplash.setAttribute('aria-hidden','true');
  document.body.appendChild(waterfallSplash);

  const landscapeTouch=window.matchMedia('(orientation:landscape) and (pointer:coarse) and (max-width:1200px)').matches;
  function resize(){w=host.clientWidth;h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.fov=w<720?73:67;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  // O barco é um elemento FIXO de tela. Limitar o pitch superior impede
  // que a água desça atrás da proa, criando a falsa impressão de decolagem.
  // A câmera segue livre para olhar para baixo e moderadamente para cima.
  const MAX_SAFE_CAMERA_UP=0.10;
  function setLook(x,y){lookTargetX=clamp(x,-.15,.15);lookTargetY=clamp(y,-.28,MAX_SAFE_CAMERA_UP);}
  function setSteering(value){lateralTarget=clamp(value,-1,1)*MAX_LATERAL_METERS;}
  function resetSteering(){lateralTarget=0;lateralPosition=0;}
  // A elevação da câmera ocorre somente diante do Caboclo.
  // A proa a01 permanece independente e fixa na tela.
  let skyFocusReleased=false;
  let skyFocusBlend=0;
  function releaseSkyFocus(){skyFocusReleased=true;lookTargetY=0;}
  function resetSkyFocus(){skyFocusReleased=false;}
  function setProgress(p){
    progress=clamp(p,0,1);
    // Ao voltar para o começo do rio, a descoberta pode acontecer novamente.
    if(progress<CHAPTERS[6].at-.09)skyFocusReleased=false;
  }
  let activeStoryIndex=null;
  function tick(){if(disposed)return;requestAnimationFrame(tick);let delta=Math.min(clock.getDelta(),.05);elapsed+=delta;
    waterMat.uniforms.uTime.value=elapsed;
    animateWaterfall(elapsed);
    waterMat.uniforms.uWake.value=riverX(8-progress*228);
    const z=8-progress*228, riverCenter=riverX(z),ahead=riverX(z-10);
    const heading=Math.atan2(-(ahead-riverCenter),10);
    const idle = !started && progress<=0.0001;
    // A aproximação suave de X simula a inércia lateral sem alterar o eixo Y.
    const previousLateral=lateralPosition;
    lateralPosition+=(lateralTarget-lateralPosition)*Math.min(1,delta*2.25);
    const lateralSpeed=delta>0?(lateralPosition-previousLateral)/delta:0;
    const x=riverCenter+lateralPosition;
    lookX+=(lookTargetX-lookX)*Math.min(1,delta*2.8);
    lookY+=(lookTargetY-lookY)*Math.min(1,delta*2.8);
    // Nos trechos normais: câmera e barco completamente estáveis no Y.
    // Exceção narrativa única: a queda física do rio entre as paradas 4 e 5.
    // A câmera acompanha SOMENTE A DESCIDA da água, sem elevar-se na queda.
    // W/S e arrasto vertical permanecem limitados à rotação do olhar.
    // A DESCIDA DO BARCO: inicia antes da borda, inclina a proa na queda e
    // recupera a horizontalidade antes da quinta parada. Fora desta janela,
    // todos os valores são zero: o comportamento aprovado da V22 é preservado.
    const diveIn=smooth(clamp((FALL_Z+12-z)/9.5,0,1));
    const diveOut=1-smooth(clamp((FALL_Z+.8-z)/4.7,0,1));
    const noseDive=diveIn*diveOut;
    const splashIn=smooth(clamp((FALL_Z+2.5-z)/3,0,1));
    const splashOut=1-smooth(clamp((FALL_Z-.8-z)/3,0,1));
    const impact=splashIn*splashOut;
    const turbulence=clamp(noseDive*.50+impact*.70,0,1);
    // A proa mergulha; o casco permanece ancorado ao rodapé da tela.
    const noseAngle=32*noseDive+9*impact;
    const boatRoll=(Math.sin(elapsed*15)*.6+Math.sin(elapsed*23)*.35)*1.25*turbulence;
    const impactX=(Math.sin(elapsed*18)+.45*Math.sin(elapsed*27))*1.7*turbulence;
    const impactY=(Math.sin(elapsed*22)+.40*Math.sin(elapsed*31))*2.1*turbulence;
    const cameraBaseY=1.5-FALL_DEPTH*riverFallAmount(z);
    // Sétima parada, 'Uma curiosidade': SOMENTE a câmera sobe para ver o Caboclo.
    // Foco iniciado na aproximação; a primeira ação 'Continuar leitura' libera
    // o retorno à altura e ao ângulo normais, independentemente do progresso.
    const nearCaboclo=progress>=CHAPTERS[6].at-.037 && progress<=CHAPTERS[6].at+.004;
    const skyFocusTarget=nearCaboclo&&!skyFocusReleased?1:0;
    skyFocusBlend+=(skyFocusTarget-skyFocusBlend)*Math.min(1,delta*(skyFocusTarget?2.0:2.8));
    const cameraLift=smooth(clamp(skyFocusBlend,0,1));
    camera.position.set(x,cameraBaseY+3.15*cameraLift,z);
    sky.position.copy(camera.position);
    const turnYaw=clamp(-lateralSpeed*.048,-.09,.09);
    // Olhar ligeiramente para baixo na queda transmite profundidade e velocidade.
    // Nenhuma subida é adicionada à câmera ou ao barco.
    const fallLookDown=.11*noseDive+.045*impact;
    camera.rotation.set(lookY*(1-cameraLift)+.28*cameraLift-fallLookDown,heading+turnYaw+lookX,
      Math.sin(elapsed*14)*.008*turbulence,'YXZ');
    // Apenas durante a cachoeira é permitido inclinar a figura da proa.
    // O posicionamento horizontal normal permanece idêntico ao da V27.
    const boatImage=document.getElementById(BOAT_IMAGE_ID);
    if(boatImage){
      boatImage.style.setProperty('--boat-lateral-px',
        `${(lateralPosition/MAX_LATERAL_METERS*BOAT_OVERLAY_RANGE_PX).toFixed(2)}px`);
      // O deslocamento abaixo é causado pelo olhar da câmera — o barco real
      // continua imóvel no eixo vertical do rio. Ao subir a câmera, a proa
      // sai gradualmente pela borda inferior; ela volta junto com a câmera.
      const frameShift=(boatImage.offsetHeight+12)*cameraLift;
      boatImage.style.setProperty('--boat-camera-frame-shift',`${frameShift.toFixed(2)}px`);
      boatImage.style.setProperty('--boat-nose-angle',`${noseAngle.toFixed(2)}deg`);
      boatImage.style.setProperty('--boat-roll-angle',`${boatRoll.toFixed(2)}deg`);
      boatImage.style.setProperty('--boat-impact-x',`${impactX.toFixed(2)}px`);
      boatImage.style.setProperty('--boat-impact-y',`${impactY.toFixed(2)}px`);
    }
    waterfallSplash.style.opacity=(impact*.92).toFixed(3);
    scenicLayers.forEach(c=>{if(c.userData.faceCamera){c.rotation.y=Math.atan2(camera.position.x-c.position.x,camera.position.z-c.position.z);}});
    billboards.forEach(c=>{if(c.userData.billboard){ const dx=camera.position.x-c.position.x; const dz=camera.position.z-c.position.z; c.rotation.set(0,Math.atan2(dx,dz),c.userData.windLean||0); }});
    particles.position.y=idle?0:Math.sin(elapsed*.17)*.2;
    cascade.visible=Math.abs(z-cascadeZ)<64;
    // As gotas animam localmente; nenhuma alteração na altura do barco.
    const reveal=smooth(clamp((progress-(CHAPTERS[6].at-.088))/.067,0,1));
    const fade=1-smooth(clamp((progress-(CHAPTERS[7].at-.074))/.035,0,1));
    const form=smooth(clamp((reveal-.965)/.035,0,1));
    spiritGroup.visible=spiritReady&&reveal>.002&&fade>.002;
    spiritImage.visible=spiritGroup.visible && form>.002;
    spirit.visible=spiritGroup.visible;
    spiritImageMaterial.opacity=form*fade; // a forma sólida só entra após as partículas se assentarem
    spiritMaterial.opacity=reveal*fade*(1-form*.84);
    if(spiritGroup.visible){
      const pos=spiritGeo.attributes.position.array;
      for(let i=0;i<spiritCount;i++){
        const j=i*3,local=clamp((reveal-spiritDelays[i])/(1-spiritDelays[i]),0,1);
        const u=smooth(local),loose=(1-u),ph=spiritPhases[i],sw=spiritSwirls[i];
        pos[j]=THREE.MathUtils.lerp(spiritStart[j],spiritTarget[j],u)+Math.cos(elapsed*.90+ph)*loose*.38*sw;
        pos[j+1]=THREE.MathUtils.lerp(spiritStart[j+1],spiritTarget[j+1],u)+Math.sin(elapsed*1.04+ph)*loose*.40*sw;
        pos[j+2]=THREE.MathUtils.lerp(spiritStart[j+2],spiritTarget[j+2],u)+Math.sin(elapsed*.75+ph)*loose*.12;
      }
      spiritGeo.attributes.position.needsUpdate=true;
    }
    // A capa final precisa permanecer inteira no enquadramento.
    // Por isso ela emerge mais baixa, um pouco menor e mais próxima da linha d'água.
    const showBook=smooth(clamp((progress-(CHAPTERS[7].at-.068))/.059,0,1));
    bookGroup.visible=showBook>.002;
    bookGroup.position.y=bookFinalY-(1-showBook)*(bookScale*5.8+1.2);
    leaves.forEach((leaf,idx)=>{
      // Each leaf starts near one of the treetops, moves slowly downward,
      // meanders a little across the wind and disappears above the bank.
      const cycle=((elapsed/leaf.period)+leaf.offset)%1;
      const zWindow=((camera.position.z-6)-leaf.baseZ)%92;
      const zPos=camera.position.z-(zWindow<0?zWindow+92:zWindow)-8;
      const xPos=riverX(zPos)+leaf.bankOffset+
        Math.sin(elapsed*leaf.oscillate+leaf.sway)*.34+
        leaf.side*cycle*leaf.drift;
      const yPos=leaf.startY-cycle*(leaf.startY+.45)+Math.sin(elapsed*1.1+leaf.sway)*.06;
      leaf.mesh.visible=cycle>.01&&cycle<.985;
      leaf.mesh.position.set(xPos,yPos,zPos);
      leaf.mesh.quaternion.copy(camera.quaternion);
      leaf.mesh.rotateZ(Math.sin(elapsed*leaf.oscillate+leaf.sway)*.4+cycle*leaf.spiral);
      leaf.mesh.rotateX(Math.sin(elapsed*.75+idx)*.25);
    });
    // A ilustração fica em coordenadas IMUTÁVEIS no mundo 3D.
    // A única transformação é a rotação de abertura pela dobradiça no gramado.
    // Abertura sincronizada ao deslocamento real: termina exatamente em at.
    storyPopups.forEach((mesh,i)=>{
      const at=STORY_IMAGES[i].at;
      const openingWindow=i===0 ? .014 : .063;
      const before=smooth(clamp((progress-(at-openingWindow))/openingWindow,0,1));
      // Cada aquarela abre ao se aproximar da parada e PERMANECE erguida
      // depois que o barco passa. A âncora é fixa, e não existe fechamento
      // automático ou fade: a progressão só determina o ângulo de abertura.
      // Para evitar a sensação de que a folha acompanha o barco ainda deitada,
      // ela só entra em cena quando já começou a levantar alguns graus.
      const lift=activeStoryIndex===i ? 1 : before;
      const popupLift=smooth(clamp((lift-.12)/.88,0,1));
      mesh.visible=popupLift>.004;
      if(!mesh.visible)return;
      mesh.rotation.x=-Math.PI*.5*(1-popupLift); // apenas a dobradiça levanta
      mesh.material.opacity=1;
      // A escala e a orientação não mudam; x, y e z nunca seguem a câmera.
    });
    if(elapsed-lastReport>.12){onProgress(progress);lastReport=elapsed;}
    renderer.render(scene,camera);
  }
  onSceneReady();tick();
  function setStoryActive(activeIndex){
    activeStoryIndex=activeIndex;
  }
  return {setProgress,setLook,setSteering,resetSteering,releaseSkyFocus,resetSkyFocus,setStarted(v){started=!!v;},setStoryActive,destroy(){disposed=true;observer.disconnect();renderer.dispose();waterGeo.dispose();waterMat.dispose();treeGeo.dispose();grassGeo.dispose();pg.dispose();leafGeo.dispose();leafMaterials.forEach(m=>{m.map?.dispose();m.dispose();});grassTexture.dispose();woodTexture.dispose();
    waterfallSplash.remove();
    const oldBoat=document.getElementById(BOAT_IMAGE_ID);
    if(oldBoat){
      oldBoat.style.removeProperty('--boat-nose-angle');
      oldBoat.style.removeProperty('--boat-roll-angle');
      oldBoat.style.removeProperty('--boat-impact-x');
      oldBoat.style.removeProperty('--boat-impact-y');
      oldBoat.style.removeProperty('--boat-camera-frame-shift');
    }
    waterfallResources.forEach(resource=>resource.dispose());
    spiritGeo.dispose();spiritMaterial.dispose();spiritImage.geometry.dispose();spiritImageMaterial.map?.dispose();spiritImageMaterial.dispose();particles.material.dispose();roundParticleTexture.dispose();bookGroup.children.forEach(m=>{m.geometry.dispose();m.material.map?.dispose();m.material.dispose()});grassMats.forEach(m=>{m.map?.dispose();m.dispose();});localBushTextures.forEach(t=>t.dispose());treeMats.forEach(m=>{m.map?.dispose();m.dispose();});localTreeTextures.forEach(t=>t.dispose());derivedTreeTextures.forEach(t=>t.dispose());scenicLayers.forEach(m=>{m.material.map?.dispose();m.material.dispose();m.geometry.dispose();});storyGeo.dispose();storyPopups.forEach(m=>{m.material.map?.dispose();m.material.dispose();});sky.geometry.dispose();sky.material.dispose();host.removeChild(renderer.domElement);}};
}

// Pop-ups agora vivem no mundo 3D (fixados na margem das paradas).
// Mantemos a função vazia apenas para não quebrar eventuais referências.
function PopUpScenes() {
    return null;
}
// Direcional discreto para telas sensíveis ao toque; compartilha os comandos WASD.
// Ícone de som vetorial: com X quando o vídeo está mudo e ondas quando está audível.
function IntroVolumeIcon({muted}) {
  return React.createElement('svg', {
    viewBox: '0 0 24 24', width: 22, height: 22,
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    focusable: 'false', 'aria-hidden': 'true'
  },
    React.createElement('path', {d: 'M11 5 6.5 9H3v6h3.5l4.5 4V5Z'}),
    muted
      ? React.createElement('path', {d: 'm16 9 5 6m0-6-5 6'})
      : React.createElement(React.Fragment, null,
          React.createElement('path', {d: 'M15 9a4 4 0 0 1 0 6'}),
          React.createElement('path', {d: 'M18 6a8 8 0 0 1 0 12'})
        )
  );
}

// PROA V21: derivada da imagem a01, travada na base da tela.
// A navegação é X/Z; a proa muda somente de X, nunca de Y, tamanho ou rotação.
const BOAT_IMAGE_ID='estrela-proa-vertical-travada-v22';
function ensureBoat(){
  let boat=document.getElementById(BOAT_IMAGE_ID);
  if(!boat){
    boat=document.createElement('img');
    boat.id=BOAT_IMAGE_ID;
    boat.className='boat-overlay';
    boat.src=asset('boat-overlay.webp');
    boat.alt='';
    boat.draggable=false;
    boat.setAttribute('aria-hidden','true');
    boat.setAttribute('data-boat-plane','xz-y-const-except-cascade-v24');
    document.body.appendChild(boat);
  }
  return boat;
}

function App() {
    const host = useRef(null), sceneAPI = useRef(null), drag = useRef(null), progressValue = useRef(0);
    const [ready, setReady] = useState(false), [playing, setPlaying] = useState(false), [progress, setProgress] = useState(0), [muted, setMuted] = useState(true), [tip, setTip] = useState(true), [started, setStarted] = useState(false), [reading, setReading] = useState(null), [paragraphIndex, setParagraphIndex] = useState(0), [readingVisualReady, setReadingVisualReady] = useState(false);
    const keys=useRef(new Set());
    const [introButtonReady, setIntroButtonReady] = useState(false);
    const [introSoundOn, setIntroSoundOn] = useState(false);
    const introVideoRef = useRef(null);
    const introReadyTimer = useRef(null);
    const seenChapters = useRef(new Set());
    const readingRef = useRef(null);
    readingRef.current = reading;
  // Na 7ª parada, Uma curiosidade, a proa some completamente para
  // deixar o Caboclo e a câmera livres. Volta só ao retomar a viagem.
  useEffect(()=>{
    const boat=ensureBoat();
    boat.classList.toggle('is-visible',started && progress<END_SHOW_AT);
  },[started,progress]);
    // Botão aparece em cinco segundos, mesmo em uma conexão lenta.
    useEffect(() => {
        if (started) return;
        introReadyTimer.current = setTimeout(() => setIntroButtonReady(true), 5000);
        return () => clearTimeout(introReadyTimer.current);
    }, [started]);
    const toggleIntroSound = () => {
        const video = introVideoRef.current;
        if (!video) return;
        if (introSoundOn) {
            video.muted = true;
            setIntroSoundOn(false);
            return;
        }
        clearTimeout(introReadyTimer.current);
        setIntroButtonReady(false);
        try { video.currentTime = 0; } catch (_) {}
        video.volume = 1;
        video.muted = false;
        setIntroSoundOn(true);
        const attempt = video.play();
        if (attempt?.catch) attempt.catch(() => { video.muted = true; setIntroSoundOn(false); });
        introReadyTimer.current = setTimeout(() => setIntroButtonReady(true), 5000);
    };
    useEffect(() => { const api = makeScene(host.current, p => setProgress(p), () => setReady(true)); sceneAPI.current = api; return () => { sceneAPI.current = null; api.destroy(); }; }, []);
    // Aceleração progressiva somente durante pressão contínua.
    const boostPointer=useRef(null);
    const speedFactor=useRef(1);
    const [accelerating,setAccelerating]=useState(false);
    const boostRequested=()=>boostPointer.current!==null||keys.current.has('w')||keys.current.has('arrowup');
    const syncBoostUI=()=>setAccelerating(boostRequested());
    useEffect(()=>{if(!playing||reading!==null){boostPointer.current=null;speedFactor.current=1;setAccelerating(false);}},[playing,reading]);
    useEffect(()=>{if(!playing)return;let id,prev=performance.now();const advance=now=>{
      const dt=Math.min((now-prev)/1000,.1);prev=now;
      const boosting=boostRequested()&&readingRef.current===null;
      const desired=boosting?2.7:1;
      speedFactor.current+=(desired-speedFactor.current)*Math.min(1,dt*(boosting?5:3.8));
      let next=advanceTrip(progressValue.current,dt*speedFactor.current);
      const nextStop=CHAPTERS.find((_,index)=>!seenChapters.current.has(index));
      if(nextStop)next=Math.min(next,nextStop.at);
      progressValue.current=next;
      sceneAPI.current?.setProgress(next);
      if(nextStop&&next>=nextStop.at-0.000001)setProgress(nextStop.at);
      if(next>=1){setPlaying(false);return;}
      id=requestAnimationFrame(advance);
    };id=requestAnimationFrame(advance);return()=>cancelAnimationFrame(id);},[playing]);
    const jump = p => { progressValue.current = p; sceneAPI.current?.setProgress(p); setProgress(p); CHAPTERS.forEach((c, i) => { if (c.at < p - .001)
        seenChapters.current.add(i); }); if (p > 0 && !started) {
        setStarted(true);
        sceneAPI.current?.setStarted(true);
    } };
    useEffect(() => {
        if (!started || reading !== null) return;
        const i = CHAPTERS.findIndex((c, idx) => progress >= c.at && !seenChapters.current.has(idx));
        if (i < 0) return;
        // Ao alcançar a bolinha, pausa exatamente no mesmo ponto da história.
        const stopAt = CHAPTERS[i].at;
        progressValue.current = stopAt;
        sceneAPI.current?.setProgress(stopAt);
        setProgress(stopAt);
        seenChapters.current.add(i);
        setPlaying(false);
        setParagraphIndex(0);
        setReading(i);
    }, [progress, playing, reading, started]);
    // No marcador, a ilustração já está erguida; a leitura pode surgir imediatamente.
    useEffect(() => {
        sceneAPI.current?.setStoryActive(reading !== null && reading < STORY_IMAGES.length ? reading : null);
        setReadingVisualReady(reading !== null);
    }, [reading]);
    const openChapter = i => { seenChapters.current.add(i); sceneAPI.current?.resetSkyFocus(); setPlaying(false); setParagraphIndex(0); setReading(i); };
    const closeChapter = () => {
        if (reading === CHAPTERS.length - 1) {
            jump(Math.max(END_SHOW_AT, progressValue.current));
            setReading(null);
            setPlaying(false);
            return;
        }
        setReading(null);
        setPlaying(true);
    };
    const paragraphs = reading === null ? [] : readingSlides(CHAPTERS[reading]);
    const nextParagraph = () => { if (reading === 6) sceneAPI.current?.releaseSkyFocus();
      if (paragraphIndex < paragraphs.length - 1)
        setParagraphIndex(i => i + 1);
      else
        closeChapter(); };
    const previousParagraph = () => setParagraphIndex(i => Math.max(0, i - 1));
    const restart = () => { enableGyro(); requestFullscreenView(); resetControls(); sceneAPI.current?.resetSkyFocus(); jump(0); seenChapters.current.clear(); setReading(null); setParagraphIndex(0); setPlaying(true); setStarted(true); sceneAPI.current?.setStarted(true); setTip(false); };
    const start = () => { if (progressValue.current >= .99) {
        restart();
        return;
    } enableGyro(); requestFullscreenView(); setPlaying(true); setStarted(true); sceneAPI.current?.setStarted(true); setTip(false); };
    const coords = useRef({ y: 0 });
    const steering = useRef(0);
    const gyroOffset = useRef(0);
    const gyroNeutral = useRef(null);
    const gyroCleanup = useRef(null);
    const gyroPending = useRef(false);
    const gyroReady = useRef(false);
    const playingRef = useRef(false);
    const applyLook = () => sceneAPI.current?.setLook(gyroOffset.current, coords.current.y);
    const applySteering = () => sceneAPI.current?.setSteering(steering.current);
    const resetControls = () => { steering.current=0; coords.current.y=0; sceneAPI.current?.resetSteering(); applyLook(); };
    useEffect(() => { playingRef.current = playing; }, [playing]);
    const onMobileDevice = () => window.matchMedia('(pointer: coarse), (max-width: 750px)').matches;
    const installGyro = () => {
        if (!onMobileDevice() || gyroCleanup.current) return;
        const onOrientation = event => {
            if (readingRef.current !== null) return;
            const angle = window.screen?.orientation?.angle ?? window.orientation ?? 0;
            const landscape = Math.abs(angle) % 180 === 90;
            // Com o aparelho deitado, a inclinação lateral passa para o eixo beta.
            const raw = landscape ? (angle === 90 ? event.beta : -event.beta) : event.gamma;
            if (typeof raw !== 'number' || !Number.isFinite(raw)) return;
            const mode = landscape ? `landscape-${angle}` : 'portrait';
            // Amostra a posição inicial do aparelho antes de permitir a inclinação.
            if (gyroNeutral.current?.mode !== mode) {
                gyroNeutral.current = { mode, raw, samples: 1 };
                gyroOffset.current = 0;
                applyLook();
                return;
            }
            const neutral = gyroNeutral.current;
            if (neutral.samples < 14) {
                const diff = ((raw - neutral.raw + 540) % 360) - 180;
                neutral.raw += diff / (neutral.samples + 1);
                neutral.samples++;
                gyroOffset.current = 0;
                applyLook();
                return;
            }
            const delta = ((raw - neutral.raw + 540) % 360) - 180;
            const settled = Math.sign(delta) * Math.max(0, Math.abs(delta) - 6);
            // Corrige o sentido para a câmera 3D: inclinar à direita = olhar à direita.
            const target = clamp(-settled / 230, -.085, .085);
            gyroOffset.current += (target - gyroOffset.current) * .10;
            applyLook();
        };
        window.addEventListener('deviceorientation', onOrientation, true);
        gyroCleanup.current = () => window.removeEventListener('deviceorientation', onOrientation, true);
        gyroReady.current = true;
    };
    const enableGyro = () => {
        if (!onMobileDevice() || !('DeviceOrientationEvent' in window) || gyroReady.current || gyroPending.current) return;
        const request = window.DeviceOrientationEvent?.requestPermission;
        if (typeof request === 'function') {
            gyroPending.current = true;
            try {
                Promise.resolve(request.call(window.DeviceOrientationEvent))
                    .then(permission => { if (permission === 'granted') installGyro(); })
                    .catch(() => {})
                    .finally(() => { gyroPending.current = false; });
            } catch (_) { gyroPending.current = false; }
        } else installGyro();
    };
    const requestFullscreenView = () => {
        if (!onMobileDevice() || document.fullscreenElement || document.webkitFullscreenElement) return;
        const element = document.documentElement;
        const request = element.requestFullscreen || element.webkitRequestFullscreen;
        if (typeof request !== 'function') return;
        try {
            const result = request.call(element, { navigationUI: 'hide' });
            result?.catch?.(() => {});
        } catch (_) {}
    };
    useEffect(() => {
        const onRotate = () => {
            gyroNeutral.current = null;
            gyroOffset.current = 0;
            applyLook();
            if (window.matchMedia('(orientation: landscape)').matches) requestFullscreenView();
        };
        window.addEventListener('orientationchange', onRotate);
        window.screen?.orientation?.addEventListener?.('change', onRotate);
        return () => {
            window.removeEventListener('orientationchange', onRotate);
            window.screen?.orientation?.removeEventListener?.('change', onRotate);
            gyroCleanup.current?.();
            gyroCleanup.current = null;
        };
    }, []);
    useEffect(() => { if (started) enableGyro(); }, [started]);
  useEffect(()=>{
    const normalize=e=>e.key.toLowerCase();
    const supported=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
    const down=e=>{
      const k=normalize(e);
      if(!supported.includes(k))return;
      if(document.querySelector('.narrative')||/input|textarea|select/i.test(document.activeElement?.tagName||''))return;
      e.preventDefault();keys.current.add(k);syncBoostUI();setTip(false);
    };
    const up=e=>{keys.current.delete(normalize(e));syncBoostUI();};
    const blur=()=>{keys.current.clear();boostPointer.current=null;syncBoostUI();};
    const visibility=()=>{if(document.hidden)blur();};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
    let raf,last=performance.now();
    const controls=now=>{
      const dt=Math.min((now-last)/1000,.05);last=now;
      const held=k=>keys.current.has(k);
      if(readingRef.current===null){
        // A/D, esquerda/direita: direção do barco no plano horizontal.
        const horizontal=(held('d')||held('arrowright')?1:0)-(held('a')||held('arrowleft')?1:0);
        if(horizontal){
          steering.current=clamp(steering.current+horizontal*dt*.73,-1,1);
          applySteering();
        }
        // W/S, cima/baixo: APENAS inclinação vertical da câmera.
        // Avanço da embarcação continua pelo passeio automático.
        const vertical=(held('w')||held('arrowup')?1:0)-(held('s')||held('arrowdown')?1:0);
        if(vertical){
          coords.current.y=clamp(coords.current.y+vertical*dt*.36,-.28,.10);
          applyLook();
        }
      }
      raf=requestAnimationFrame(controls);
    };
    raf=requestAnimationFrame(controls);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  function down(e){
    drag.current={x:e.clientX,y:e.clientY,lane:steering.current,pitch:coords.current.y};
    // Toque longo no celular ou botão esquerdo do mouse pressionado no cenário.
    if(e.isPrimary && (e.pointerType!=='mouse'||e.button===0) && playingRef.current && readingRef.current===null){
      boostPointer.current=e.pointerId;
      syncBoostUI();
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e){
    if(!drag.current || readingRef.current!==null)return;
    const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;
    // Arrastar na horizontal conduz a proa para esquerda/direita.
    steering.current=clamp(drag.current.lane+dx/Math.max(window.innerWidth,320)*2.25,-1,1);
    // Arrastar na vertical somente aponta a câmera para cima/baixo.
    coords.current.y=clamp(drag.current.pitch+dy*.0019,-.28,.10);
    applySteering();applyLook();
  }
  function up(e){
    if(boostPointer.current===e.pointerId){boostPointer.current=null;syncBoostUI();}
    drag.current=null;
  }
    const waterfallMoment = false; // Cachoeira animada no mundo 3D, sem flash 2D
    return React.createElement("main", { className: "experience" },
        React.createElement("div", { className: "stage", ref: host, onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up, onLostPointerCapture: up, onContextMenu: e=>e.preventDefault(), onDoubleClick: resetControls }),
        React.createElement(PopUpScenes, null),
        React.createElement("div", { className: "paper", "aria-hidden": "true" }),
        React.createElement("div", { className: "vignette", "aria-hidden": "true" }),
        waterfallMoment && React.createElement("div", { className: "cascade-flash", "aria-hidden": "true" },
            React.createElement("i", null),
            React.createElement("i", null),
            React.createElement("i", null),
            React.createElement("i", null),
            React.createElement("i", null),
            React.createElement("i", null),
            React.createElement("i", null)),
        !started && progress < .005 && React.createElement("section", { className: "intro-video-screen", "aria-label": "Introdução em vídeo de Lucas e o Caboclo Estrela Azul" },
            React.createElement("video", { className: "intro-video", ref: introVideoRef, autoPlay: true, muted: !introSoundOn, playsInline: true, preload: "auto",
                onTimeUpdate: e => { if (e.currentTarget.currentTime >= 5) setIntroButtonReady(true); },
                onEnded: () => setIntroButtonReady(true), onError: () => setIntroButtonReady(true) },
                React.createElement("source", { media: "(max-width: 750px)", src: asset('intro-mobile.mp4'), type: "video/mp4" }),
                React.createElement("source", { src: asset('intro-widescreen.mp4'), type: "video/mp4" })),
            React.createElement("button", { type: "button", className: "intro-audio-toggle", onClick: toggleIntroSound, "aria-label": introSoundOn ? 'Silenciar áudio da abertura' : 'Ativar áudio da abertura', title: introSoundOn ? 'Silenciar áudio' : 'Ativar áudio', "aria-pressed": introSoundOn },
                React.createElement(IntroVolumeIcon, { muted: !introSoundOn })),
            React.createElement("div", { className: `intro-video-cta ${introButtonReady ? 'is-visible' : ''}` },
                React.createElement("button", { type: "button", className: "asset-button start-image-button intro-start-button", onClick: start, disabled: !ready || !introButtonReady, "aria-label": ready ? 'Começar passeio' : 'Preparando cenário' },
                    React.createElement("img", { src: asset('button-start.webp'), alt: "Iniciar passeio" }),
                    !ready && React.createElement("span", { className: "button-loading-label" }, "Preparando cenário")))),
        reading !== null && readingVisualReady && React.createElement("section", { className: `narrative ${reading < 6 && CHAPTERS[reading].side === 'left' ? 'narrative-right' : ''}`, "aria-label": CHAPTERS[reading].eyebrow },
            React.createElement("div", { className: "narrative-inner", key: `${reading}-${paragraphIndex}` },
                paragraphIndex === 0 && React.createElement("span", { className: "narrative-chapter" },
                    CHAPTERS[reading].eyebrow),
                paragraphIndex === 0 && React.createElement("h2", null, CHAPTERS[reading].title),
                React.createElement("div", { className: "narrative-paragraph" }, paragraphs[paragraphIndex].split('\n\n').map((part, i) => React.createElement("p", { key: i }, part))),
                React.createElement("div", { className: "narrative-actions" },
                    React.createElement("button", { type: "button", className: "narrative-prev", onClick: previousParagraph, disabled: paragraphIndex === 0, "aria-label": "Par\u00E1grafo anterior" },
                        "\u2190 ",
                        React.createElement("span", null, "VOLTAR")),
                    React.createElement("button", { type: "button", className: "narrative-next", onClick: nextParagraph },
                        paragraphIndex === paragraphs.length - 1 ? 'CONTINUAR PASSEIO' : 'CONTINUAR LEITURA',
                        " ",
                        React.createElement("span", null, "\u2192"))))),
        progress >= END_SHOW_AT && !playing && reading === null && React.createElement("div", { className: "intro end" },
            React.createElement("span", { className: "kicker" }, "FIM DA TRAVESSIA"),
            React.createElement("h1", null,
                "Lucas ",
                React.createElement("em", null, "e o Caboclo Estrela Azul.")),
            React.createElement("div", { className: "end-message" },
                React.createElement("p", null, React.createElement("strong", null, "Flávio, agradeço pela confiança no meu trabalho e pela oportunidade de fazer parte da criação deste livro.")),
                React.createElement("p", null, React.createElement("strong", null, "Obrigado por permitir que essa ideia ganhasse forma e por me confiar a responsabilidade de contribuir para que ela chegasse a outras pessoas.")),
                React.createElement("p", null, React.createElement("strong", null, "Que este livro encontre novos leitores, desperte sentimentos e preserve, em cada página, um pouco daquilo que o tornou tão especial.")),
                React.createElement("p", null, React.createElement("strong", null, "Foi um prazer fazer parte dessa história."))),
            React.createElement("a", { className: "asset-button start-image-button home-exit-link", href: "https://barbarasmaia.com.br/", "aria-label": "Voltar para Home" },
                React.createElement("img", { src: asset('button-home.webp'), alt: "", "aria-hidden": "true" }))),
        tip && playing && React.createElement("div", { className: "hint", onClick: () => setTip(false) },
            "SEGURE PARA ACELERAR · LADOS: BARCO · CIMA/BAIXO: CÂMERA ",
            React.createElement("span", null, "\u00D7")),
        React.createElement("footer", { className: "footer" },
            React.createElement("div", { className: "footer-left" },
                React.createElement("span", { className: "tiny-label" }, "O PASSEIO"),
                React.createElement("span", { className: "clock" },
                    String(Math.floor(travelTimeAt(progress) / 60)).padStart(2, '0'),
                    ":",
                    String(Math.floor(travelTimeAt(progress) % 60)).padStart(2, '0'),
                    " ",
                    React.createElement("span", null, "/ 01:00"))),
            React.createElement("div", { className: "timeline" },
                React.createElement("input", { type: "range", min: "0", max: "1", step: "0.001", value: travelTimeAt(progress) / DURATION, "aria-label": "Progresso da viagem", style: { '--pct': `${travelTimeAt(progress) / DURATION * 100}%` }, onChange: e => jump(progressAtTravelTime(Number(e.target.value) * DURATION)) }),
                React.createElement("div", { className: "milestones" }, CHAPTERS.map((c, i) => React.createElement("button", { key: i, style: { left: `${CHAPTER_TIMES[i] / DURATION * 100}%` }, onClick: () => { jump(c.at); openChapter(i); }, title: c.eyebrow + ' — ' + c.title })))),
            React.createElement("button", { className: "play", onClick: () => reading !== null ? nextParagraph() : playing ? setPlaying(false) : start(), disabled: !ready, "aria-label": playing ? 'Pausar passeio' : 'Continuar passeio' }, playing ? 'Ⅱ' : '▶')),
        React.createElement("div", { className: "bottom-label" }, "LUCAS E O CABOCLO ESTRELA AZUL \u00B7 PROCESSO CRIATIVO"),
        muted === false && React.createElement("div", { className: "audio-note", onClick: () => setMuted(true) },
            "O \u00E1udio poder\u00E1 ser adicionado na pr\u00F3xima vers\u00E3o. ",
            React.createElement("span", null, "\u00D7")));
}
createRoot(document.getElementById('root')).render(React.createElement(App, null));
