/* The Hall of Attempts — framed browsing build.
 * No orbiting. The camera sits in fixed frames: an overview and one frame per exhibit.
 * Arrows / wheel / nav step between exhibits; Esc returns to the overview.
 * Visible exhibit surfaces share one picking pass; rendering is invalidated on demand.
 */
(function () {
  'use strict';

  const COLORS = { excellent: 0x37e08a, good: 0x7de3ff, partial: 0xffc857, weak: 0xff9f43, failed: 0xff3b5c };
  const HEX = { excellent: '#37e08a', good: '#7de3ff', partial: '#ffc857', weak: '#ff9f43', failed: '#ff3b5c' };
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let REDUCE = motionQuery.matches;

  const el = document.getElementById('scene');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x080a0a, 0.018);

  function pixelRatio() { return Math.min(devicePixelRatio || 1, innerWidth <= 760 ? 1.5 : 2); }
  const initialRect = el.getBoundingClientRect();
  const camera = new THREE.PerspectiveCamera(50, initialRect.width / initialRect.height, 0.1, 140);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: innerWidth > 760 });
  } catch (error) {
    document.body.classList.add('webgl-unavailable');
    document.getElementById('fallback').open = true;
    document.getElementById('status').textContent = '3D unavailable — browse the exhibits below.';
    return;
  }
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(initialRect.width, initialRect.height);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  el.appendChild(renderer.domElement);

  const hall = new THREE.Group();
  scene.add(hall);
  let hallSpin = 0;
  const hoverBounds = new THREE.Box3();
  const hoverOutline = new THREE.Box3Helper(hoverBounds, 0xc9a86a);
  hoverOutline.visible = false;
  scene.add(hoverOutline);
  let highlighted = -1;
  function highlight(i) {
    if (i === highlighted) return;
    highlighted = i;
    hoverOutline.visible = i >= 0;
    if (i >= 0) {
      hall.updateWorldMatrix(true, true);
      hoverBounds.makeEmpty();
      for (const object of items[i].selectables) hoverBounds.expandByObject(object);
    }
    render();
  }
  // All illumination comes from the overhead oculus: a soft sky bounce and
  // broad downward key describe the same architectural light source.
  scene.add(new THREE.HemisphereLight(0xc9d9e7, 0x30271d, 0.65));
  const skylight = new THREE.SpotLight(0xffedcc, 3.8, 75, 1.02, 0.72, 1);
  skylight.position.set(0, 14, 0);
  skylight.target.position.set(0, 0, 0);
  skylight.castShadow = true;
  skylight.shadow.mapSize.set(innerWidth <= 760 ? 512 : 1024, innerWidth <= 760 ? 512 : 1024);
  skylight.shadow.radius = innerWidth <= 760 ? 3 : 5;
  skylight.shadow.blurSamples = innerWidth <= 760 ? 4 : 8;
  skylight.shadow.bias = -0.0004;
  skylight.shadow.normalBias = 0.035;
  skylight.shadow.camera.near = 2;
  skylight.shadow.camera.far = 45;
  scene.add(skylight, skylight.target);

  function stoneTexture(base, vein, seed) {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, 512, 512);
    let n = seed;
    const random = () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; };
    for (let k = 0; k < 110; k++) {
      const yy = random() * 650 - 70;
      x.strokeStyle = vein; x.globalAlpha = 0.035 + random() * 0.06;
      x.lineWidth = 0.4 + random() * 2.5; x.beginPath();
      for (let px = 0; px <= 512; px += 8) {
        const py = yy + Math.sin(px * 0.012 + k) * 16 + Math.sin(px * 0.043 + k * 2) * 3;
        if (!px) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
    }
    for (let k = 0; k < 1800; k++) {
      x.globalAlpha = random() * 0.06; x.fillStyle = random() > 0.5 ? '#fff' : '#342b20';
      x.fillRect(random() * 512, random() * 512, 1 + random() * 3, 1);
    }
    x.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(c); texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return texture;
  }
  const marble = stoneTexture('#c5bba5', '#6f6556', 37);
  const travertine = stoneTexture('#8a806c', '#3f382c', 93);
  const stone = new THREE.MeshStandardMaterial({ map: marble, roughness: 0.68, metalness: 0.03 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0xa69a83, map: marble, roughness: 0.6 });
  const G = {
    base: new THREE.BoxGeometry(1.62, 0.26, 1.62),
    plinth: new THREE.BoxGeometry(1.34, 0.16, 1.34),
    shaft: (() => {
      const geo = new THREE.CylinderGeometry(0.48, 0.55, 1.95, 80, 8);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), r = Math.hypot(x, z);
        if (!r) continue;
        const flute = 0.025 * (1 + Math.cos(Math.atan2(z, x) * 20)) / 2;
        const rr = r - flute; pos.setXYZ(i, x * rr / r, pos.getY(i), z * rr / r);
      }
      geo.computeVertexNormals(); return geo;
    })(),
    collar: new THREE.TorusGeometry(0.5, 0.05, 8, 24),
    cap: new THREE.BoxGeometry(1.2, 0.16, 1.2),
    abacus: new THREE.BoxGeometry(1.4, 0.1, 1.4),
    pool: new THREE.PlaneGeometry(6, 6),
  };

  function pedestal() {
    const g = new THREE.Group();
    const put = (geo, mat, y) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.y = y;
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      return m;
    };
    put(G.base, stoneDark, 0.13);
    put(G.plinth, stone, 0.34);
    put(G.shaft, stone, 1.4);
    put(G.collar, stone, 2.38).rotation.x = Math.PI / 2;
    put(G.cap, stone, 2.5);
    put(G.abacus, stoneDark, 2.63);
    g.userData.topY = 2.68;
    return g;
  }

  const poolTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 6, 128, 128, 126);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.14)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  })();

  // One light-weight particle field catches the skylight; it stays fixed in the room.
  const dustCount = innerWidth <= 760 ? 420 : 1100;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustOrigins = new Float32Array(dustCount * 3);
  const dustColors = new Float32Array(dustCount * 3);
  let dustSeed = 719;
  const dustRandom = () => { dustSeed = (dustSeed * 1664525 + 1013904223) >>> 0; return dustSeed / 4294967296; };
  for (let i = 0; i < dustCount; i++) {
    const angle = dustRandom() * Math.PI * 2;
    const radius = Math.sqrt(dustRandom()) * 13;
    dustOrigins[i * 3] = Math.cos(angle) * radius;
    dustOrigins[i * 3 + 1] = 0.5 + dustRandom() * 12;
    dustOrigins[i * 3 + 2] = Math.sin(angle) * radius;
    const brightness = (0.4 + dustRandom() * 0.6) * (1 - radius / 21);
    dustColors.set([brightness, brightness * 0.91, brightness * 0.74], i * 3);
  }
  dustPositions.set(dustOrigins);
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3).setUsage(THREE.DynamicDrawUsage));
  dustGeometry.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
    map: poolTex, vertexColors: true, transparent: true, opacity: 0.82, size: 0.065,
    sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  dust.frustumCulled = false;
  scene.add(dust);
  let dustTime = 0;
  function driftDust(dt) {
    dustTime += dt;
    for (let i = 0; i < dustCount; i++) {
      const phase = i * 2.39996;
      dustPositions[i * 3] = dustOrigins[i * 3] + Math.sin(dustTime * 0.12 + phase) * 0.18;
      dustPositions[i * 3 + 1] = 0.5 + ((dustOrigins[i * 3 + 1] - 0.5 + dustTime * 0.025) % 12);
      dustPositions[i * 3 + 2] = dustOrigins[i * 3 + 2] + Math.cos(dustTime * 0.09 + phase) * 0.14;
    }
    dustGeometry.attributes.position.needsUpdate = true;
  }

  // A fixed architectural shell surrounds the rotating exhibition ring.
  const architecture = new THREE.Group();
  scene.add(architecture);
  const limestone = new THREE.MeshStandardMaterial({ color: 0x8d8069, map: travertine, roughness: 0.92 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xb2a080, map: travertine, roughness: 0.8 });
  const recess = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, toneMapped: false, side: THREE.DoubleSide });
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = floorCanvas.height = 1024;
  const fx = floorCanvas.getContext('2d');
  fx.fillStyle = '#36332d'; fx.fillRect(0, 0, 1024, 1024);
  function floorSector(r0, r1, a0, a1, color) {
    fx.beginPath(); fx.arc(512, 512, r1, a0, a1);
    fx.arc(512, 512, r0, a1, a0, true); fx.closePath(); fx.fillStyle = color; fx.fill();
  }
  for (let band = 0; band < 12; band++) for (let i = 0; i < 48; i++) {
    const offset = (band % 2) * Math.PI / 48;
    floorSector(band * 44 + 1, (band + 1) * 44 - 1,
      i * Math.PI / 24 + offset + 0.001, (i + 1) * Math.PI / 24 + offset - 0.001,
      ['#3e3c34', '#444037', '#393b35', '#4a453b'][(i * 7 + band * 3) % 4]);
  }
  // An inlaid marble compass rose anchors the circular exhibition.
  fx.beginPath(); fx.arc(512, 512, 182, 0, Math.PI * 2); fx.fillStyle = '#252e2c'; fx.fill();
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, r = i % 2 ? 80 : 153;
    fx.beginPath(); fx.moveTo(512, 512);
    fx.lineTo(512 + Math.cos(a - 0.09) * 40, 512 + Math.sin(a - 0.09) * 40);
    fx.lineTo(512 + Math.cos(a) * r, 512 + Math.sin(a) * r);
    fx.lineTo(512 + Math.cos(a + 0.09) * 40, 512 + Math.sin(a + 0.09) * 40);
    fx.closePath(); fx.fillStyle = i % 2 ? '#81765c' : '#b3a487'; fx.fill();
  }
  for (const radius of [32, 177, 182, 195, 320, 480]) {
    fx.beginPath(); fx.arc(512, 512, radius, 0, Math.PI * 2);
    fx.strokeStyle = radius === 182 ? '#b0a07e' : '#6f6551'; fx.lineWidth = radius === 182 ? 4 : 1; fx.stroke();
  }
  const floorMap = new THREE.CanvasTexture(floorCanvas);
  floorMap.encoding = THREE.sRGBEncoding;
  floorMap.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const floor = new THREE.Mesh(new THREE.CircleGeometry(32, 128),
    new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.62, metalness: 0.08 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  architecture.add(floor);

  function horizontalRing(radius, tube, y, material) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 96), material);
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = y;
    architecture.add(mesh);
    return mesh;
  }
  const brass = new THREE.MeshStandardMaterial({ color: 0x8f7950, metalness: 0.65, roughness: 0.4 });
  for (const radius of [6.2, 11.4]) horizontalRing(radius, 0.014, 0.018, brass);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(31, 31, 14, 64, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x756b58, map: travertine, roughness: 0.95, side: THREE.BackSide }));
  wall.position.y = 7; architecture.add(wall);
  for (const y of [0.25, 10.6, 11.2, 13.5]) horizontalRing(30.6, y === 0.25 ? 0.3 : 0.18, y, trim);

  // Repeated recessed archways and piers establish the room's circumference.
  const count = 20;
  const piers = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.64, 10.4, 12), limestone, count);
  const capitals = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.36, 1.5), trim, count);
  const matrix = new THREE.Matrix4();
  const archShape = new THREE.Shape();
  archShape.moveTo(-1.75, 0); archShape.lineTo(-1.75, 5.6);
  archShape.absarc(0, 5.6, 1.75, Math.PI, 0, true);
  archShape.lineTo(1.75, 0); archShape.closePath();
  const archGeometry = new THREE.ShapeGeometry(archShape, 20);
  const frameShape = archShape.clone();
  const opening = new THREE.Path();
  opening.moveTo(-1.48, 0.2); opening.lineTo(1.48, 0.2); opening.lineTo(1.48, 5.6);
  opening.absarc(0, 5.6, 1.48, 0, Math.PI, false); opening.lineTo(-1.48, 0.2);
  frameShape.holes.push(opening);
  const frameGeometry = new THREE.ExtrudeGeometry(frameShape, { depth: 0.72, bevelEnabled: true,
    bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 1, steps: 1, curveSegments: 20 });
  const archFrames = new THREE.InstancedMesh(frameGeometry, trim, count);
  const archVoids = new THREE.InstancedMesh(archGeometry, recess, count);
  const transform = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    matrix.makeTranslation(Math.cos(a) * 29.5, 5.2, Math.sin(a) * 29.5);
    piers.setMatrixAt(i, matrix);
    matrix.makeTranslation(Math.cos(a) * 29.5, 10.55, Math.sin(a) * 29.5);
    capitals.setMatrixAt(i, matrix);
    const mid = a + Math.PI / count;
    transform.position.set(Math.cos(mid) * 30.4, 0.3, Math.sin(mid) * 30.4);
    transform.rotation.set(0, -mid - Math.PI / 2, 0);
    transform.scale.set(1, 1, 1); transform.updateMatrix();
    archFrames.setMatrixAt(i, transform.matrix);
    transform.position.addScaledVector(new THREE.Vector3(Math.cos(mid), 0, Math.sin(mid)), -0.025);
    transform.position.y += 0.18;
    transform.scale.set(0.86, 0.94, 1); transform.updateMatrix();
    archVoids.setMatrixAt(i, transform.matrix);
  }
  architecture.add(piers, capitals, archFrames, archVoids);

  // A shallow masonry dome, with recessed coffers, leads into the oculus.
  const domeHeight = r => 10.5 + Math.sqrt(Math.max(0, 31 * 31 - r * r)) * 0.12;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(31, 80, 24, 0, Math.PI * 2,
    Math.asin(7 / 31), Math.PI / 2 - Math.asin(7 / 31)),
    new THREE.MeshStandardMaterial({ color: 0x70634f, map: travertine, side: THREE.BackSide, roughness: 1 }));
  dome.scale.y = 0.12; dome.position.y = 10.5; architecture.add(dome);
  for (const radius of [7, 7.35, 12, 20, 29]) horizontalRing(radius, radius < 8 ? 0.14 : 0.07, domeHeight(radius) - 0.1, trim);
  const positions = [], colors = [];
  for (let band = 0; band < 4; band++) for (let i = 0; i < count; i++) {
    const rings = [7.7, 12, 20, 27, 30];
    const r0 = rings[band] + 0.17, r1 = rings[band + 1] - 0.17;
    const a0 = i / count * Math.PI * 2 + 0.014, a1 = (i + 1) / count * Math.PI * 2 - 0.014;
    function point(r, a) { return [Math.cos(a) * r, domeHeight(r) - 0.045, Math.sin(a) * r]; }
    for (let r = 0; r < 3; r++) for (let t = 0; t < 3; t++) {
      const rr0 = r0 + (r1 - r0) * r / 3, rr1 = r0 + (r1 - r0) * (r + 1) / 3;
      const aa0 = a0 + (a1 - a0) * t / 3, aa1 = a0 + (a1 - a0) * (t + 1) / 3;
      const pts = [point(rr0, aa0), point(rr1, aa0), point(rr1, aa1), point(rr0, aa0), point(rr1, aa1), point(rr0, aa1)];
      for (const pt of pts) { positions.push(...pt); const shade = 0.19 + band * 0.025; colors.push(shade, shade * 0.9, shade * 0.73); }
    }
  }
  const coffers = new THREE.BufferGeometry();
  coffers.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  coffers.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); coffers.computeVertexNormals();
  architecture.add(new THREE.Mesh(coffers, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 })));
  const skyCanvas = document.createElement('canvas'); skyCanvas.width = skyCanvas.height = 256;
  const skyContext = skyCanvas.getContext('2d');
  const skyGradient = skyContext.createRadialGradient(130, 100, 5, 128, 128, 160);
  skyGradient.addColorStop(0, '#fff9e5'); skyGradient.addColorStop(0.6, '#d8e5e9'); skyGradient.addColorStop(1, '#8aafc8');
  skyContext.fillStyle = skyGradient; skyContext.fillRect(0, 0, 256, 256);
  const skyTexture = new THREE.CanvasTexture(skyCanvas); skyTexture.encoding = THREE.sRGBEncoding;
  const sky = new THREE.Mesh(new THREE.CircleGeometry(7, 80),
    new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.DoubleSide, toneMapped: false }));
  sky.rotation.x = Math.PI / 2; sky.position.y = domeHeight(7) + 0.2; architecture.add(sky);

  // A soft contact pool beneath the exhibition suggests the skylight's footprint.
  const skyPool = new THREE.Mesh(new THREE.PlaneGeometry(30, 30),
    new THREE.MeshBasicMaterial({ map: poolTex, color: 0xb8c7d5, transparent: true,
      opacity: 0.15, depthWrite: false, blending: THREE.AdditiveBlending }));
  skyPool.rotation.x = -Math.PI / 2; skyPool.position.y = 0.01;
  architecture.add(skyPool);

  function marbleTexture(m, i) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 512, 256);
    g.addColorStop(0, '#e9e1d0'); g.addColorStop(1, '#cec4b0');
    x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    let seed = i * 9301 + 49297;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let k = 0; k < 12; k++) {
      x.strokeStyle = `rgba(88,80,66,${0.12 + rnd() * 0.2})`;
      x.lineWidth = 0.8 + rnd() * 2.6;
      x.beginPath();
      let px = rnd() * 512, py = rnd() * 256;
      x.moveTo(px, py);
      for (let s = 0; s < 4; s++) { px += (rnd() - 0.5) * 220; py += (rnd() - 0.5) * 120; x.lineTo(px, py); }
      x.stroke();
    }
    x.strokeStyle = 'rgba(150,128,90,0.5)'; x.lineWidth = 3; x.strokeRect(10, 10, 492, 236);
    x.fillStyle = '#8a6a34'; x.font = '600 34px ui-monospace, monospace';
    x.fillText(m.numeral || '', 34, 76);
    x.fillStyle = '#16181c';
    let size = 46;
    x.font = `600 ${size}px Georgia, serif`;
    while (x.measureText(m.name).width > 430 && size > 26) {
      size -= 2;
      x.font = `600 ${size}px Georgia, serif`;
    }
    x.fillText(m.name, 34, 150);
    x.fillStyle = '#57503f'; x.font = '24px ui-monospace, monospace';
    x.fillText(`${m.backend} · ${(m.faces || 0).toLocaleString()} faces`, 34, 196);
    x.fillStyle = HEX[m.verdict] || '#888';
    x.beginPath(); x.arc(470, 58, 8, 0, Math.PI * 2); x.fill();
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    return t;
  }

  const items = [];
  const navEl = document.getElementById('nav');
  const plaque = document.getElementById('plaque');
  const live = document.getElementById('live');
  const statusEl = document.getElementById('status');

  let loaded = 0;
  let view = 'overview';
  let cur = -1;
  let camTarget = new THREE.Vector3(0, 2.3, 0);
  let tweenRaf = null;
  let turnRaf = null;
  let renderRaf = null;
  let pedestalRaf = null;
  let pedestalMode = 'outward';

  function overviewFrame() {
    const radius = Math.max(25, 10.5 / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect));
    return { position: new THREE.Vector3(0, 7.9, radius), target: new THREE.Vector3(0, 4.5, 0) };
  }

  function frameFor(i) {
    const a = items[i].a - hallSpin;
    // Focus gives the object and its plaque priority; the upper column stays in view.
    const distance = Math.max(4.8, 1.15 / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect));
    const r = 8.6 - distance;
    return { position: new THREE.Vector3(Math.cos(a) * r, 3.8, Math.sin(a) * r),
      target: new THREE.Vector3(Math.cos(a) * 8.6, items[i].topY + 0.7, Math.sin(a) * 8.6) };
  }

  function place(f) {
    camera.position.copy(f.position);
    camera.lookAt(f.target);
  }

  function render() {
    if (renderRaf !== null) return;
    renderRaf = requestAnimationFrame(() => {
      renderRaf = null;
      renderer.render(scene, camera);
    });
  }

  function tweenTo(to, ms) {
    if (tweenRaf !== null) cancelAnimationFrame(tweenRaf);
    tweenRaf = null;
    const from = { position: camera.position.clone(), target: camTarget.clone() };
    const dur = REDUCE ? 0 : ms;
    const t0 = performance.now();
    if (dur === 0) {
      camTarget.copy(to.target); place(to); render(); return;
    }
    function step(now) {
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const f = { position: new THREE.Vector3().lerpVectors(from.position, to.position, e),
        target: new THREE.Vector3().lerpVectors(from.target, to.target, e) };
      camTarget.copy(f.target); place(f); render();
      tweenRaf = t < 1 ? requestAnimationFrame(step) : null;
    }
    tweenRaf = requestAnimationFrame(step);
  }

  const CARD_TILT = 0.18;
  const CARD_TOP = 0.3 + 0.3 * Math.cos(CARD_TILT);
  // The upper edge meets the 1.4-wide abacus rim; the label hangs below it.
  const CARD_OFFSET = 0.7 + 0.008 - (0.18 - 0.3 * Math.sin(CARD_TILT));
  function orientPedestals(inward, immediate = false) {
    const mode = inward ? 'inward' : 'outward';
    if (mode === pedestalMode && !immediate) return;
    pedestalMode = mode;
    if (pedestalRaf !== null) cancelAnimationFrame(pedestalRaf);
    pedestalRaf = null;
    const turns = items.map(it => {
      const from = it.stand.rotation.y;
      const goal = Math.PI / 2 - it.a + (inward ? Math.PI : 0);
      // Always turn in the same direction, including an interrupted mode change.
      let delta = ((goal - from) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (delta > Math.PI * 2 - 1e-8) delta = 0;
      return { stand: it.stand, from, delta };
    });
    if (REDUCE || immediate) {
      for (const turn of turns) turn.stand.rotation.y = turn.from + turn.delta;
      render(); return;
    }
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / 650);
      const eased = t * t * (3 - 2 * t);
      for (const turn of turns) turn.stand.rotation.y = turn.from + turn.delta * eased;
      render();
      pedestalRaf = t < 1 ? requestAnimationFrame(step) : null;
    }
    pedestalRaf = requestAnimationFrame(step);
  }

  function announce(i) {
    const m = items[i].meta;
    live.textContent = `Exhibit ${i + 1} of ${items.length}: ${m.name}, verdict ${m.verdict}. ${m.note}`;
  }

  function updatePlaque(i) {
    if (i < 0) { plaque.classList.remove('show'); return; }
    const m = items[i].meta;
    document.getElementById('plaque-src').src = m.source;
    document.getElementById('plaque-src').alt = 'source image for ' + m.name;
    document.getElementById('plaque-num').textContent = 'EXHIBIT ' + (m.numeral || i + 1);
    document.getElementById('plaque-name').textContent = m.name;
    const v = document.getElementById('plaque-verdict');
    v.innerHTML = `<span class="dot" style="background:${HEX[m.verdict] || '#66748d'}"></span>${m.verdict}`;
    v.style.color = HEX[m.verdict] || '#8fa0b8';
    document.getElementById('plaque-note').textContent = m.note || '';
    document.getElementById('plaque-meta').textContent =
      `${m.backend} · ${(m.faces || 0).toLocaleString()} faces · ${m.mb} MiB` +
      (m.licence ? ` · ${m.licence}` : '');
    const credit = document.getElementById('plaque-credit');
    credit.href = 'credits.html#' + m.id;
    credit.textContent = m.author + ' · ' + m.licence + ' · source & changes';
    plaque.classList.add('show');
  }

  function updateNav() {
    document.body.classList.toggle('is-focused', view === 'focus');
    document.getElementById('back-to-hall').hidden = view === 'overview';
    [...navEl.children].forEach((b, i) => {
      b.classList.toggle('active', i === cur);
      b.setAttribute('aria-pressed', String(i === cur));
    });
    document.getElementById('prev').disabled = !items.length;
    document.getElementById('next').disabled = !items.length;
    document.getElementById('hint').textContent = view === 'overview'
      ? 'Drag to rotate the hall · select an object · ← → browse'
      : innerWidth <= 760
        ? 'Drag to rotate this object · tap empty space to return to the hall'
        : 'Drag to rotate this object · ← → browse · Esc back to hall';
  }

  function focus(i, push) {
    if (!items.length) return;
    i = (i + items.length) % items.length;
    clearPointer();
    document.getElementById('hover-label').hidden = true;
    highlight(-1);
    view = 'focus'; cur = i;
    orientPedestals(true);
    tweenTo(frameFor(i), 700);
    updatePlaque(i);
    updateNav();
    updateDetail();
    announce(i);
    if (push !== false) history.pushState({ i }, '', '#/' + items[i].meta.id);

  }

  function overview(push) {
    clearPointer();
    document.getElementById('hover-label').hidden = true;
    highlight(-1);
    view = 'overview'; cur = -1;
    updateDetail();
    orientPedestals(false);
    tweenTo(overviewFrame(), 700);
    updatePlaque(-1);
    updateNav();
    live.textContent = `Overview, ${items.length} exhibits.`;
    if (push !== false) history.pushState({}, '', '#/');

  }

  function step(d) {
    if (view === 'overview') return focus(d > 0 ? 0 : items.length - 1);
    focus(cur + d);
  }



  const loader = new THREE.GLTFLoader();
  const decoder = window.MeshoptDecoder || THREE.MeshoptDecoder;
  if (decoder) loader.setMeshoptDecoder(decoder);

  const queue = [];
  let activeLoads = 0;
  let failures = 0;
  function disposeObject(obj) {
    const textures = new Set(), materials = new Set(), images = new Set();
    obj.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      for (const mat of (Array.isArray(o.material) ? o.material : [o.material])) if (mat) {
        materials.add(mat);
        Object.values(mat).forEach(v => { if (v && v.isTexture) textures.add(v); });
      }
    });
    textures.forEach(t => {
      if (t.image && typeof t.image.close === 'function') images.add(t.image);
      t.dispose();
    });
    images.forEach(image => image.close());
    materials.forEach(m => m.dispose());
  }
  function updateDetail() {
    for (const it of items) if (it.high && (view !== 'focus' || it.i !== cur)) {
      it.spin.remove(it.high); disposeObject(it.high); it.high = null;
      if (it.low) it.spin.add(it.low);
    }
    if (view === 'focus' && items[cur]) enqueue(items[cur], true);
  }
  function enqueue(item, high) {
    const tier = high ? 'high' : 'low';
    if (item[tier] || item.loading.has(tier)) return;
    item.loading.add(tier);
    const task = { item, high, tier };
    high ? queue.unshift(task) : queue.push(task);
    pump();
  }
  function pump() {
    while (activeLoads < 2 && queue.length) {
      const { item, high, tier } = queue.shift();
      if (high && (view !== 'focus' || cur !== item.i)) { item.loading.delete(tier); continue; }
      activeLoads++;
      let finished = false;
      function complete() {
        if (finished) return;
        finished = true;
        item.loading.delete(tier); activeLoads--;
        statusEl.hidden = loaded === items.length && failures === 0;
        statusEl.textContent = failures
          ? 'Some exhibits could not load. Descriptions are available below.'
          : 'Loading the collection…';
        pump();
      }
      function failed(error) {
        console.error('load failed', item.meta.file, error);
        if (!high) { loaded++; failures++; }
        live.textContent = 'A model could not load. The exhibit description remains available.';
      }
      try { loader.load('models/' + (high ? item.meta.file : item.meta.overviewFile), gltf => {
        try {
        const obj = new THREE.Group();
        obj.add(gltf.scene);
        // Level the reconstructed base before computing the displayed bounds.
        // The model then spins around an upright Y axis without rocking.
        if (item.meta.presentationQuaternion) obj.quaternion.fromArray(item.meta.presentationQuaternion);
        if (high && (view !== 'focus' || cur !== item.i)) { disposeObject(obj); return; }
        obj.traverse(o => {
          if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
          if (o.isMesh && o.material && o.material.map)
            o.material.map.anisotropy = Math.min(innerWidth <= 760 ? 2 : 4, renderer.capabilities.getMaxAnisotropy());
        });
        const box = new THREE.Box3().setFromObject(obj, true);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        let contactRadius = 0;
        if (item.meta.presentationQuaternion) {
          const vertex = new THREE.Vector3();
          obj.traverse(mesh => {
            if (!mesh.isMesh) return;
            const positions = mesh.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
              vertex.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
              if (vertex.y <= box.min.y + size.y * 0.06)
                contactRadius = Math.max(contactRadius, Math.hypot(vertex.x - center.x, vertex.z - center.z));
            }
          });
        }
        // Keep the supporting feet/base inside the top slab throughout the turntable rotation.
        const scale = 1 / Math.max(size.y / 1.7, Math.max(size.x, size.z) / 1.65, contactRadius / 0.65);
        const clearance = item.meta.presentationQuaternion ? 0.005 : 0.035;
        obj.scale.setScalar(scale);
        obj.position.set(-center.x * scale, -box.min.y * scale + clearance, -center.z * scale);
        if (!item.spin) { item.spin = new THREE.Group(); item.pivot.add(item.spin); }
        item[tier] = obj;
        if (high && item.low) item.spin.remove(item.low);
        if (high || !item.high) item.spin.add(obj);
        if (!high) loaded++;
        render();
        syncTurntable();
        } catch (error) { failed(error); }
        finally { complete(); }
      }, undefined, error => { failed(error); complete(); });
      } catch (error) { failed(error); complete(); }
    }
  }
  function indexFromHash() {
    const token = /^#\/([^/]+)$/.exec(location.hash);
    if (!token) return -1;
    return items.findIndex(it => it.meta.id === token[1] || String(it.meta.legacyId) === token[1]);
  }
  fetch('models/index.json').then(r => {
    if (!r.ok) throw new Error('Manifest unavailable');
    return r.json();
  }).then(list => {
    const R = 8.6;
    list.forEach((m, i) => {
      const a = (i / list.length) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;

      const stand = new THREE.Group();
      stand.userData.itemIndex = i;
      stand.position.set(x, 0, z);
      stand.rotation.y = Math.PI / 2 - a;
      hall.add(stand);
      const col = pedestal();
      col.userData.itemIndex = i;
      stand.add(col);
      const topY = col.userData.topY;

      const pool = new THREE.Mesh(G.pool, new THREE.MeshBasicMaterial({
        map: poolTex, color: 0x11141a, transparent: true,
        depthWrite: false, opacity: 0.5,
      }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, 0.015, z);
      hall.add(pool);

      const tex = marbleTexture(m, i);
      const panelMat = new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.6, metalness: 0.04, side: THREE.DoubleSide,
        emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.06,
      });
      const panelGeo = new THREE.PlaneGeometry(1.15, 0.6);
      const tent = new THREE.Group();
      tent.userData.itemIndex = i;
      const front = new THREE.Mesh(panelGeo, panelMat);
      front.position.set(0, 0.3, 0.18);
      front.rotation.x = -CARD_TILT;
      tent.add(front);
      tent.position.set(0, topY - CARD_TOP, CARD_OFFSET);
      stand.add(tent);

      const pivot = new THREE.Group();
      pivot.userData.itemIndex = i;
      pivot.position.set(0, topY, 0);
      stand.add(pivot);

      const item = {
        i, meta: m, stand, pivot, spin: null, pool, tent, a, x, z, topY,
        selectables: [pivot, col, tent],
        low: null, high: null, loading: new Set(),
      };
      items.push(item);

      const nb = document.createElement('button');
      nb.textContent = m.numeral;
      nb.setAttribute('aria-label', m.name);
      nb.setAttribute('aria-pressed', 'false');
      nb.addEventListener('click', () => focus(i));
      nb.addEventListener('focus', () => highlight(i));
      nb.addEventListener('blur', () => highlight(-1));
      navEl.appendChild(nb);
    });
    const selected = indexFromHash();
    if (selected >= 0) focus(selected, false);
    else if (location.hash && location.hash !== '#/') live.textContent = 'This exhibit is unavailable. Browse the public collection.';
    const ordered = [...items];
    if (selected >= 0) ordered.unshift(...ordered.splice(selected, 1));
    ordered.forEach(it => enqueue(it, false));
    updateNav(); render();
  }).catch(error => {
    console.error(error);
    statusEl.textContent = 'Gallery could not load — browse descriptions below.';
    document.getElementById('fallback').open = true;
  });

  // --- input -----------------------------------------------------------------
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'Escape' || e.key === 'Home' || e.key.toLowerCase() === 'o') { e.preventDefault(); overview(); }
    else if (/^[1-7]$/.test(e.key)) { const i = Number(e.key) - 1; if (i < items.length) focus(i); }
  });

  document.getElementById('prev').addEventListener('click', () => step(-1));
  document.getElementById('next').addEventListener('click', () => step(1));
  document.getElementById('back-to-hall').addEventListener('click', e => {
    e.preventDefault();
    const previous = cur;
    overview();
    if (previous >= 0) navEl.children[previous].focus({ preventScroll: true });
  });

  let wheelLock = 0;
  renderer.domElement.addEventListener('wheel', e => {
    if (innerWidth <= 760 || e.ctrlKey || e.metaKey) return;
    if (Math.abs(e.deltaY) < 30) return;
    e.preventDefault();
    const now = performance.now();
    if (now - wheelLock < 450) return;
    wheelLock = now;
    step(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  renderer.domElement.style.touchAction = innerWidth <= 760 ? 'pan-y' : 'none';
  function clearPointer(e) {
    if (!down || (e && e.pointerId !== undefined && e.pointerId !== down.pointerId)) return;
    const pointerId = down.pointerId;
    down = null;
    try { renderer.domElement.releasePointerCapture(pointerId); } catch (_) {}
  }
  renderer.domElement.addEventListener('pointerdown', e => {
    if (down || e.isPrimary === false || e.button !== 0) return;
    down = { pointerId: e.pointerId, x: e.clientX, y: e.clientY,
      lastX: e.clientX, t: performance.now(), drag: false };
    try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) {}
  });
  renderer.domElement.addEventListener('pointercancel', clearPointer);
  renderer.domElement.addEventListener('lostpointercapture', clearPointer);
  addEventListener('blur', () => clearPointer());
  addEventListener('pointerup', clearPointer);
  renderer.domElement.addEventListener('pointermove', e => {
    if (!down || e.pointerId !== down.pointerId) return;
    if (e.buttons === 0) { clearPointer(e); return; }
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    const deltaX = e.clientX - down.lastX;
    down.lastX = e.clientX;
    if (Math.hypot(dx, dy) > 4) down.drag = true;
    if (down.drag && view === 'focus' && cur >= 0 && items[cur].spin) {
      items[cur].spin.rotation.y += deltaX * 0.012;
      render();
    } else if (down.drag && view === 'overview') {
      hallSpin += deltaX * 0.006;
      hall.rotation.y = hallSpin;
      render();
    }
  });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || e.pointerId !== down.pointerId) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 300;
    const wasDrag = down.drag;
    clearPointer(e);
    if (wasDrag || !quick || moved > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX >= rect.right ||
        e.clientY < rect.top || e.clientY >= rect.bottom) return;
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1);
    // Picking must use the same transforms even when rendering is scheduled later.
    hall.updateWorldMatrix(true, true);
    camera.updateWorldMatrix(true, false);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(items.flatMap(it => it.selectables), true);
    if (hits.length) {
      let o = hits[0].object;
      while (o && o.userData.itemIndex === undefined) o = o.parent;
      if (o) focus(o.userData.itemIndex);
    } else if (view === 'focus') overview();
  });

  addEventListener('resize', () => {
    if (tweenRaf !== null) { cancelAnimationFrame(tweenRaf); tweenRaf = null; }
    const rect = el.getBoundingClientRect();
    renderer.domElement.style.touchAction = innerWidth <= 760 ? 'pan-y' : 'none';
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(rect.width, rect.height);
    const frame = view === 'focus' && cur >= 0 ? frameFor(cur) : overviewFrame();
    camTarget.copy(frame.target);
    place(frame);
    render();
  });

  // Automatic turntable, paused while hidden or when reduced motion is requested.
  function syncTurntable() {
    const animate = !document.hidden && !REDUCE && items.some(it => it.spin);
    if (!animate) {
      if (turnRaf !== null) cancelAnimationFrame(turnRaf);
      turnRaf = null;
      return;
    }
    if (turnRaf !== null) return;
    let last = performance.now();
    function loop(now) {
      turnRaf = null;
      if (document.hidden || REDUCE) return;
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      const list = view === 'focus' && cur >= 0 ? [items[cur]] : items;
      for (const it of list) if (it.spin) it.spin.rotation.y += 0.35 * dt;
      driftDust(dt);
      render();
      turnRaf = requestAnimationFrame(loop);
    }
    turnRaf = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', syncTurntable);
  motionQuery.addEventListener('change', e => {
    REDUCE = e.matches;
    syncTurntable();
    if (REDUCE) {
      orientPedestals(view === 'focus', true);
      dispatchEvent(new Event('resize'));
    }
  });

  // --- boot ------------------------------------------------------------------
  function followHash() {
    const i = indexFromHash();
    if (i >= 0) focus(i, false); else overview(false);
  }
  addEventListener('popstate', followHash);
  addEventListener('hashchange', followHash);
  for (const link of document.querySelectorAll('#fallback-list a[data-exhibit]')) {
    link.addEventListener('click', e => {
      const i = items.findIndex(it => it.meta.id === link.dataset.exhibit);
      if (i >= 0) { e.preventDefault(); focus(i); }
    });
  }
  const hover = document.getElementById('hover-label');
  renderer.domElement.addEventListener('pointerleave', () => { hover.hidden = true; highlight(-1); });
  renderer.domElement.addEventListener('pointermove', e => {
    if (down) { hover.hidden = true; highlight(-1); return; }
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    hall.updateWorldMatrix(true, true); camera.updateWorldMatrix(true, false);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(items.flatMap(it => it.selectables), true);
    let o = hits.length ? hits[0].object : null;
    while (o && o.userData.itemIndex === undefined) o = o.parent;
    hover.hidden = !o;
    highlight(o ? o.userData.itemIndex : -1);
    renderer.domElement.style.cursor = o ? 'pointer' : 'grab';
    if (o) {
      hover.textContent = items[o.userData.itemIndex].meta.name;
      hover.style.left = Math.min(e.clientX + 12, innerWidth - 180) + 'px';
      hover.style.top = (e.clientY + 12) + 'px';
    }
  });
  const initialFrame = overviewFrame();
  place(initialFrame); camTarget.copy(initialFrame.target); render();

})();
