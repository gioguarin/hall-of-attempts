/* The Hall of Attempts — framed browsing build.
 * No orbiting. The camera sits in fixed frames: an overview and one frame per exhibit.
 * Arrows / wheel / nav step between exhibits; Esc returns to the overview.
 * Labels are HTML placards projected from 3D, so they stay crisp at any DPR.
 */
(function () {
  'use strict';

  const COLORS = { excellent: 0x37e08a, good: 0x7de3ff, partial: 0xffc857, weak: 0xff9f43, failed: 0xff3b5c };
  const HEX = { excellent: '#37e08a', good: '#7de3ff', partial: '#ffc857', weak: '#ff9f43', failed: '#ff3b5c' };
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const el = document.getElementById('scene');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070b);
  scene.fog = new THREE.FogExp2(0x05070b, 0.017);

  const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 140);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  el.appendChild(renderer.domElement);

  const hall = new THREE.Group();
  scene.add(hall);
  let hallSpin = 0;
  const Y = new THREE.Vector3(0, 1, 0);
  scene.add(new THREE.HemisphereLight(0x31425e, 0x06070a, 0.9));
  const sun = new THREE.DirectionalLight(0xffe6c2, 1.7);
  sun.position.set(7, 14, 9);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x6f9bd6, 0.45);
  fill.position.set(-9, 6, -8);
  scene.add(fill);

  const stone = new THREE.MeshLambertMaterial({ color: 0xd6ccba });
  const stoneDark = new THREE.MeshLambertMaterial({ color: 0xa89d8b });
  const G = {
    base: new THREE.BoxGeometry(1.62, 0.26, 1.62),
    plinth: new THREE.BoxGeometry(1.34, 0.16, 1.34),
    shaft: new THREE.CylinderGeometry(0.5, 0.56, 1.95, 24, 1),
    collar: new THREE.TorusGeometry(0.5, 0.05, 8, 24),
    cap: new THREE.BoxGeometry(1.2, 0.16, 1.2),
    abacus: new THREE.BoxGeometry(1.4, 0.1, 1.4),
    pool: new THREE.PlaneGeometry(6, 6),
    hit: new THREE.CylinderGeometry(1.15, 1.15, 6, 8),
  };
  const hiddenMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

  function pedestal() {
    const g = new THREE.Group();
    const put = (geo, mat, y) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.y = y;
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

  const floor = new THREE.Mesh(new THREE.CircleGeometry(17, 64),
    new THREE.MeshLambertMaterial({ color: 0x0a0d13 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(8.6, 0.035, 6, 128),
    new THREE.MeshBasicMaterial({ color: 0xc9a86a }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.012;
  scene.add(ring);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(23, 23, 16, 40, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x0b0f16, side: THREE.BackSide }));
  wall.position.y = 8;
  scene.add(wall);


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

  function tentGeometry() {
    const w = 1.15, h = 0.58, d = 0.5, hw = w / 2;
    const A = [-hw, 0, d / 2], B = [hw, 0, d / 2], C = [hw, h, 0], D = [-hw, h, 0];
    const E = [-hw, 0, -d / 2], F = [hw, 0, -d / 2];
    const pos = [], uv = [], idx = [];
    const quad = (p0, p1, p2, p3, u) => {
      const b = pos.length / 3;
      pos.push(...p0, ...p1, ...p2, ...p3);
      uv.push(...u);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    quad(A, B, C, D, [0, 0, 1, 0, 1, 1, 0, 1]);
    const front = idx.length;
    quad(F, E, D, C, [0, 0, 0, 0, 0, 0, 0, 0]);
    quad(A, E, F, B, [0, 0, 0, 0, 0, 0, 0, 0]);
    const tri = (a, b, c) => {
      const i0 = pos.length / 3;
      pos.push(...a, ...b, ...c); uv.push(0, 0, 0, 0, 0, 0);
      idx.push(i0, i0 + 1, i0 + 2);
    };
    tri(A, D, E); tri(B, F, C);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.addGroup(0, front, 0);
    g.addGroup(front, idx.length - front, 1);
    return g;
  }

  const items = [];
  const pinsEl = document.getElementById('pins');
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
  let turning = true;

  const OVERVIEW = { angle: Math.PI / 2, radius: 21.5, height: 7.9, target: new THREE.Vector3(0, 2.4, 0) };

  function frameFor(i) {
    const a = (i / items.length) * Math.PI * 2 - Math.PI / 2 - hallSpin;
    const fit = Math.min(1.5, Math.max(1, 1.15 / camera.aspect));
    // camera sits near the centre of the ring, 8 units out from the column
    const r = Math.max(0.5, 8.6 - 8.0 * fit);
    return {
      angle: a, radius: r, height: 3.2,
      target: new THREE.Vector3(Math.cos(a) * 8.6, 2.5, Math.sin(a) * 8.6),
    };
  }

  function place(f) {
    camera.position.set(Math.cos(f.angle) * f.radius, f.height, Math.sin(f.angle) * f.radius);
    camera.lookAt(f.target);
  }

  function render() {
    renderer.render(scene, camera);
    positionPins();
  }

  function tweenTo(to, ms) {
    if (tweenRaf) cancelAnimationFrame(tweenRaf);
    const from = {
      angle: Math.atan2(camera.position.z, camera.position.x),
      radius: Math.hypot(camera.position.x, camera.position.z),
      height: camera.position.y,
      target: camTarget.clone(),
    };
    let da = to.angle - from.angle;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const dur = REDUCE ? 0 : ms;
    const t0 = performance.now();
    if (dur === 0) {
      camTarget.copy(to.target);
      place(to);
      render();
      return;
    }
    function step(now) {
      const t = Math.min(1, (now - t0) / dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const f = {
        angle: from.angle + da * e,
        radius: from.radius + (to.radius - from.radius) * e,
        height: from.height + (to.height - from.height) * e,
        target: new THREE.Vector3().lerpVectors(from.target, to.target, e),
      };
      camTarget.copy(f.target);
      place(f);
      render();
      tweenRaf = t < 1 ? requestAnimationFrame(step) : null;
    }
    tweenRaf = requestAnimationFrame(step);
  }

  function setTentDir(it, dir) {
    const off = 0.58 * dir;
    it.tent.position.set(it.x + Math.cos(it.a) * off, it.topY + 0.02, it.z + Math.sin(it.a) * off);
    it.tent.rotation.y = Math.PI / 2 - it.a + (dir < 0 ? Math.PI : 0);
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
      `${m.backend} · ${(m.faces || 0).toLocaleString()} faces · ${m.mb} MB` +
      (m.licence ? ` · ${m.licence}` : '');
    plaque.classList.add('show');
  }

  function updateNav() {
    [...navEl.children].forEach((b, i) => b.classList.toggle('active', i === cur));
    document.getElementById('prev').disabled = view === 'overview';
    document.getElementById('next').disabled = view === 'overview';
  }

  function focus(i, push) {
    if (!items.length) return;
    i = (i + items.length) % items.length;
    if (cur >= 0 && cur !== i) setTentDir(items[cur], 1);
    view = 'focus'; cur = i;
    setTentDir(items[i], -1);
    tweenTo(frameFor(i), 700);
    updatePlaque(i);
    updateNav();
    announce(i);
    if (push !== false) history.pushState({ i }, '', '#/' + (i + 1));
    positionPins();
  }

  function overview(push) {
    view = 'overview'; cur = -1;
    for (const it of items) setTentDir(it, 1);
    tweenTo(OVERVIEW, 700);
    updatePlaque(-1);
    updateNav();
    live.textContent = `Overview, ${items.length} exhibits.`;
    if (push !== false) history.pushState({}, '', '#/');
    positionPins();
  }

  function step(d) {
    if (view === 'overview') return focus(d > 0 ? 0 : items.length - 1);
    focus(cur + d);
  }

  function positionPins() {}


  const loader = new THREE.GLTFLoader();
  const decoder = window.MeshoptDecoder || THREE.MeshoptDecoder;
  if (decoder) loader.setMeshoptDecoder(decoder);

  fetch('models/index.json').then(r => r.json()).then(list => {
    const R = 8.6;
    list.forEach((m, i) => {
      const a = (i / list.length) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;

      const col = pedestal();
      col.position.set(x, 0, z);
      col.rotation.y = -a;
      hall.add(col);
      const topY = col.userData.topY;

      const pool = new THREE.Mesh(G.pool, new THREE.MeshBasicMaterial({
        map: poolTex, color: COLORS[m.verdict] || 0xffffff, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.45,
      }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, 0.015, z);
      hall.add(pool);

      const hit = new THREE.Mesh(G.hit, hiddenMat);
      hit.position.set(x, 3, z);
      hit.userData.i = i;
      hall.add(hit);

      const tex = marbleTexture(m, i);
      const panelMat = new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.6, metalness: 0.04, side: THREE.DoubleSide,
        emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.06,
      });
      const panelGeo = new THREE.PlaneGeometry(1.15, 0.6);
      const tent = new THREE.Group();
      const front = new THREE.Mesh(panelGeo, panelMat);
      front.position.set(0, 0.3, 0.18);
      front.rotation.x = -0.42;
      const back = new THREE.Mesh(panelGeo, panelMat);
      back.position.set(0, 0.3, -0.18);
      back.rotation.y = Math.PI;
      back.rotation.x = 0.42;
      tent.add(front, back);
      tent.position.set(x + Math.cos(a) * 0.58, topY + 0.02, z + Math.sin(a) * 0.58);
      tent.rotation.y = Math.PI / 2 - a;
      hall.add(tent);

      const pivot = new THREE.Group();
      pivot.userData.itemIndex = i;
      pivot.position.set(x, topY, z);
      hall.add(pivot);

      const item = {
        i, meta: m, pivot, spin: null, pool, tent, a, x, z, topY,
        anchor: new THREE.Vector3(x, topY + 2.0, z),
      };
      items.push(item);

      loader.load('models/' + m.file, gltf => {
        const obj = gltf.scene;
        obj.traverse(o => {
          if (o.isMesh && o.material && o.material.map) {
            o.material.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          }
        });
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const s = 1.45 / Math.max(size.y, 0.6 * Math.max(size.x, size.z));
        obj.scale.setScalar(s);
        obj.position.set(-center.x * s, -center.y * s + 1.62, -center.z * s);
        const spin = new THREE.Group();
        spin.add(obj);
        pivot.add(spin);
        item.spin = spin;
        loaded++;
        statusEl.textContent = `${loaded}/${list.length} loaded`;
        render();
        if (loaded === list.length) {
          statusEl.textContent = `${list.length} pieces · ready`;
          document.title = 'Hall of Attempts 3D';
          startTurntableIfNeeded();
        }
      }, undefined, err => {
        console.error('load failed', m.file, err);
        loaded++;
        if (loaded === list.length) document.title = 'Hall of Attempts 3D';
      });

      const nb = document.createElement('button');
      nb.textContent = m.numeral || i + 1;
      nb.setAttribute('role', 'tab');
      nb.setAttribute('aria-label', `Exhibit ${i + 1}: ${m.name}`);
      nb.style.borderColor = HEX[m.verdict] || '#2a3448';
      nb.addEventListener('click', () => focus(i));
      navEl.appendChild(nb);
    });

    const n = parseInt((/^#\/(\d+)$/.exec(location.hash) || [0, 0])[1], 10);
    if (n >= 1 && n <= items.length) setTimeout(() => focus(n - 1, false), 60);
  });

  // --- input -----------------------------------------------------------------
  addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'Escape' || e.key === 'Home' || e.key.toLowerCase() === 'o') { e.preventDefault(); overview(); }
    else if (/^[1-9]$/.test(e.key)) focus(parseInt(e.key, 10) - 1);
  });

  document.getElementById('prev').addEventListener('click', () => step(-1));
  document.getElementById('next').addEventListener('click', () => step(1));
  document.getElementById('overviewBtn').addEventListener('click', () => overview());

  let wheelLock = 0;
  addEventListener('wheel', e => {
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
  renderer.domElement.addEventListener('pointerdown', e => {
    down = { x: e.clientX, y: e.clientY, t: performance.now(), drag: false };
    try { renderer.domElement.setPointerCapture(e.pointerId); } catch (_) {}
  });
  renderer.domElement.addEventListener('pointercancel', () => { down = null; });
  addEventListener('pointerup', () => { down = null; });
  renderer.domElement.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (Math.hypot(dx, dy) > 4) down.drag = true;
    if (down.drag && view === 'focus' && cur >= 0 && items[cur].spin) {
      items[cur].spin.rotation.y += (e.movementX || 0) * 0.012;
      render();
    } else if (down.drag && view === 'overview') {
      hallSpin += (e.movementX || 0) * 0.006;
      hall.rotation.y = hallSpin;
      render();
    }
  });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 300;
    const wasDrag = down.drag;
    down = null;
    if (wasDrag || !quick || moved > 5) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const modelHits = ray.intersectObjects(items.map(it => it.pivot), true);
    if (modelHits.length) {
      let o = modelHits[0].object;
      while (o && o.userData.itemIndex === undefined) o = o.parent;
      if (o) return focus(o.userData.itemIndex);
    }
    const hitMeshes = hall.children.filter(o => o.userData && typeof o.userData.i === 'number');
    const h2 = ray.intersectObjects(hitMeshes, false);
    if (h2.length) focus(h2[0].object.userData.i);
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    if (view === 'focus' && cur >= 0) place(frameFor(cur));
    else place(OVERVIEW);
    render();
  });

  // --- turntable -------------------------------------------------------------
  const rotBtn = document.getElementById('rotate');
  function startTurntableIfNeeded() {
    if (!turning || turnRaf) return;
    let last = performance.now();
    function loop(now) {
      if (!turning) { turnRaf = null; return; }
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      const list = view === 'focus' && cur >= 0 ? [items[cur]] : items;
      const t = now / 1000;
      for (const it of list) if (it.spin) {
        it.spin.rotation.y += 0.35 * dt;
        it.spin.position.y = Math.sin(t * 0.8 + it.i) * 0.035;
      }
      render();
      turnRaf = requestAnimationFrame(loop);
    }
    turnRaf = requestAnimationFrame(loop);
  }
  rotBtn.textContent = 'stop turntable';
  rotBtn.style.borderColor = '#c9a86a';
  rotBtn.addEventListener('click', () => {
    turning = !turning;
    rotBtn.textContent = turning ? 'stop turntable' : 'turntable';
    rotBtn.style.borderColor = turning ? '#c9a86a' : '';
    if (turning) startTurntableIfNeeded();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && turning) {
      turning = false; rotBtn.textContent = 'turntable'; rotBtn.style.borderColor = '';
    }
  });

  // --- boot ------------------------------------------------------------------
  addEventListener('popstate', () => {
    const n = parseInt((/^#\/(\d+)$/.exec(location.hash) || [0, 0])[1], 10);
    if (n >= 1 && n <= items.length) focus(n - 1, false); else overview(false);
  });

  place(OVERVIEW);
  camTarget.copy(OVERVIEW.target);
  camera.lookAt(camTarget);
  render();

})();
