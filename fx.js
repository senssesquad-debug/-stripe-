// WebGL effects: fluid hero background, floating specimen ID card,
// scroll-driven exploded document reader and 3D tilt on catalog cards.
// Every effect is optional: if WebGL or three.js is missing the page still works.

(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pointer = { x: 0, y: 0 };
  addEventListener('pointermove', e => {
    pointer.x = e.clientX / innerWidth * 2 - 1;
    pointer.y = e.clientY / innerHeight * 2 - 1;
  }, { passive: true });

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  // Calls fn every animation frame while el is on screen
  function whileVisible(el, fn) {
    let visible = false;
    let raf = 0;
    const loop = time => {
      fn(time);
      raf = visible ? requestAnimationFrame(loop) : 0;
    };
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    }).observe(el);
  }

  /* ---------- Hero: fluid violet background (plain WebGL) ---------- */

  const FLUID_SHADER = `
    precision highp float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec2 uMouse;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
      p += (uMouse - 0.5) * vec2(0.18, -0.18);
      float t = uTime * 0.05;

      // domain-warped noise gives the folded "silk smoke" look
      vec2 q = vec2(fbm(p * 1.3 + t), fbm(p * 1.3 + vec2(5.2, 1.3) - t));
      vec2 r = vec2(fbm(p * 1.3 + 3.2 * q + vec2(1.7, 9.2) + t * 1.4),
                    fbm(p * 1.3 + 3.2 * q + vec2(8.3, 2.8) - t * 1.1));
      float f = fbm(p * 1.3 + 3.6 * r);

      vec3 ink = vec3(0.045, 0.035, 0.12);
      vec3 violet = vec3(0.36, 0.17, 0.80);
      vec3 blue = vec3(0.13, 0.17, 0.95);
      vec3 pink = vec3(1.0, 0.40, 0.88);

      vec3 col = mix(ink, violet, smoothstep(0.25, 0.95, f));
      col = mix(col, blue, smoothstep(0.55, 1.15, length(q)) * 0.6);

      // thin glowing streaks along the folds
      float ridge = pow(1.0 - abs(sin(f * 8.0 + r.x * 5.0)), 7.0);
      col += ridge * mix(violet * 1.5, pink, clamp(r.y * 1.4 - 0.2, 0.0, 1.0)) * 0.85 * smoothstep(0.28, 0.75, f);
      col += pow(ridge, 4.0) * 0.45 * smoothstep(0.45, 0.8, f);

      // keep the left side darker so the headline stays readable
      col *= mix(0.42, 1.0, smoothstep(0.05, 0.8, uv.x));
      col *= smoothstep(1.35, 0.25, length(p * vec2(0.75, 1.0)));
      gl_FragColor = vec4(col, 1.0);
    }`;

  function fluidBackground(canvas) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return;

    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }'));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FLUID_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'uRes');
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uMouse = gl.getUniformLocation(program, 'uMouse');
    const mouse = { x: 0.5, y: 0.5 };
    // The fluid is soft, so half resolution looks the same and costs a quarter
    const scale = 0.5;

    function draw(time) {
      mouse.x += (pointer.x * 0.5 + 0.5 - mouse.x) * 0.03;
      mouse.y += (pointer.y * 0.5 + 0.5 - mouse.y) * 0.03;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, reduceMotion ? 40 : time / 1000 + 40);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr * scale));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      draw(performance.now());
    }
    resize();
    addEventListener('resize', resize);
    if (!reduceMotion) whileVisible(canvas, draw);
  }

  fluidBackground(document.getElementById('field'));

  /* ---------- Catalog: 3D tilt that follows the cursor ---------- */

  function tiltCards(grid) {
    if (reduceMotion || !matchMedia('(hover: hover)').matches) return;
    grid.addEventListener('pointermove', e => {
      const card = e.target.closest('.card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${-y * 9}deg) rotateY(${x * 11}deg) translateY(-6px)`;
    });
    grid.addEventListener('pointerout', e => {
      const card = e.target.closest('.card');
      if (card && !card.contains(e.relatedTarget)) card.style.transform = '';
    });
  }

  tiltCards(document.getElementById('grid'));

  /* ---------- three.js scenes ---------- */

  if (!window.THREE) return;

  function makeRenderer(canvas) {
    try {
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      return renderer;
    } catch {
      return null;
    }
  }

  // Studio lighting baked into an environment map: a dark violet room with soft boxes
  function makeEnvironment(renderer, wall = 0x241e55) {
    const room = new THREE.Scene();
    room.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: wall, side: THREE.BackSide })));
    const softbox = (hex, power, w, h, x, y, z) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(power), side: THREE.DoubleSide })
      );
      mesh.position.set(x, y, z);
      mesh.lookAt(0, 0, 0);
      room.add(mesh);
    };
    softbox(0xffffff, 4, 8, 3, 0, 8, 3);
    softbox(0xa985ff, 3, 4, 7, -8, 2, 2);
    softbox(0x5d7bff, 3, 4, 7, 8, 1, -3);
    softbox(0xffffff, 1.5, 7, 2, 0, 2, 9);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const texture = pmrem.fromScene(room, 0.04).texture;
    pmrem.dispose();
    return texture;
  }

  function fitRenderer(renderer, camera, canvas) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return false;
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    return true;
  }

  function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  // Box with rounded edges: w along x, h along y, d along z
  function roundedBox(w, h, d, r) {
    const geometry = new THREE.ExtrudeGeometry(roundedRectShape(w - 2 * r, d - 2 * r, r), {
      depth: Math.max(h - 2 * r, 0.001),
      bevelEnabled: true,
      bevelThickness: r,
      bevelSize: r,
      bevelSegments: 4,
      curveSegments: 8
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.center();
    return geometry;
  }

  /* ---------- Hero: floating specimen ID card ---------- */

  function canvasTexture(draw) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 646;
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    const paint = () => { draw(c.getContext('2d'), c.width, c.height); texture.needsUpdate = true; };
    paint();
    // repaint once the web fonts are in, the first pass may use fallbacks
    document.fonts?.ready.then(paint);
    return texture;
  }

  function guilloche(ctx, w, h, alpha) {
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 26; k++) {
      ctx.strokeStyle = `rgba(91, 47, 196, ${alpha + 0.03 * (k % 3)})`;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = h * 0.52 + Math.sin(x / 70 + k * 0.45) * (60 + k * 6) + Math.cos(x / 31 + k) * 12;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function drawCardFront(ctx, w, h) {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#f4f1ff');
    bg.addColorStop(0.55, '#e4e8ff');
    bg.addColorStop(1, '#efe3ff');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    guilloche(ctx, w, h, 0.05);

    ctx.fillStyle = '#5b2fc4';
    ctx.fillRect(0, 0, w, 88);
    ctx.fillStyle = '#fff';
    ctx.font = '700 36px "Space Grotesk", Inter, sans-serif';
    ctx.fillText('IDENTITY CARD', 48, 58);
    ctx.font = '600 22px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('UTOPIA · SPECIMEN', w - 48, 56);
    ctx.textAlign = 'left';

    const px = 48, py = 122, pw = 250, ph = 318;
    const photo = ctx.createLinearGradient(0, py, 0, py + ph);
    photo.addColorStop(0, '#dcd4f7');
    photo.addColorStop(1, '#b4a7de');
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 16);
    ctx.fillStyle = photo;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = '#7a6bb2';
    ctx.beginPath();
    ctx.arc(px + pw / 2, py + 128, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px + pw / 2, py + ph + 14, 112, 128, 0, Math.PI, 0);
    ctx.fill();
    ctx.restore();

    const fields = [['Surname', 'SPECIMEN'], ['Given names', 'ANNA'], ['Nationality', 'UTOPIAN'], ['Date of birth', '01 01 1990'], ['Document no.', 'UT0000000']];
    fields.forEach(([label, value], i) => {
      const y = 148 + i * 64;
      ctx.fillStyle = '#6b6785';
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillText(label.toUpperCase(), 340, y);
      ctx.fillStyle = '#12102a';
      ctx.font = '600 30px Inter, sans-serif';
      ctx.fillText(value, 340, y + 32);
    });

    ctx.strokeStyle = '#28234f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= 210; x += 3) {
      const y = h - 120 + Math.sin(x / 11) * 14 * Math.sin(x / 70) - x * 0.08;
      if (x === 0) ctx.moveTo(60 + x, y); else ctx.lineTo(60 + x, y);
    }
    ctx.stroke();

    ctx.save();
    ctx.translate(w * 0.6, h * 0.66);
    ctx.rotate(-0.16);
    ctx.font = '800 66px "Space Grotesk", Inter, sans-serif';
    ctx.fillStyle = 'rgba(228, 58, 92, 0.38)';
    ctx.textAlign = 'center';
    ctx.fillText('SPECIMEN', 0, 20);
    ctx.restore();

    ctx.fillStyle = 'rgba(91, 47, 196, 0.45)';
    ctx.font = '600 13px monospace';
    ctx.fillText('AUTHENTICITY VERIFIED · REGULA BALTIJA · DAUGAVPILS · '.repeat(3), 48, h - 28);
  }

  function drawCardBack(ctx, w, h) {
    ctx.fillStyle = '#eeeaff';
    ctx.fillRect(0, 0, w, h);
    guilloche(ctx, w, h, 0.035);

    const chip = ctx.createLinearGradient(70, 90, 220, 205);
    chip.addColorStop(0, '#f6dc8f');
    chip.addColorStop(1, '#c8962e');
    ctx.fillStyle = chip;
    ctx.beginPath();
    ctx.roundRect(70, 90, 150, 115, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 80, 20, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(70, 148); ctx.lineTo(220, 148);
    ctx.moveTo(145, 90); ctx.lineTo(145, 205);
    ctx.moveTo(110, 90); ctx.lineTo(110, 148);
    ctx.moveTo(180, 148); ctx.lineTo(180, 205);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, h - 210, w, 210);
    ctx.fillStyle = '#12102a';
    ctx.font = '700 40px "Courier New", monospace';
    ['IDUTO0000000001<<<<<<<<<<<<<<<', '9001014F3001015UTO<<<<<<<<<<<6', 'SPECIMEN<<ANNA<<<<<<<<<<<<<<<<'].forEach((line, i) => {
      ctx.fillText(line, 52, h - 148 + i * 54);
    });
  }

  function heroCard(canvas) {
    const renderer = makeRenderer(canvas);
    if (!renderer) return;
    const scene = new THREE.Scene();
    scene.environment = makeEnvironment(renderer, 0x6d64a8);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7fd0, 1.6));
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0, 5.8);

    const W = 1.586;
    const H = 1;
    const outline = roundedRectShape(W, H, 0.06);
    const face = new THREE.ShapeGeometry(outline, 12);
    const uv = face.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, face.attributes.position.getX(i) / W + 0.5, face.attributes.position.getY(i) / H + 0.5);
    }

    const card = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.ExtrudeGeometry(outline, { depth: 0.016, bevelEnabled: false, curveSegments: 12 }),
      new THREE.MeshPhysicalMaterial({ color: 0xf1eefc, roughness: 0.4, clearcoat: 0.5 })
    );
    body.position.z = -0.008;
    const front = new THREE.Mesh(face, new THREE.MeshPhysicalMaterial({
      map: canvasTexture(drawCardFront), roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12,
      iridescence: 0.35, iridescenceIOR: 1.35, iridescenceThicknessRange: [120, 480]
    }));
    front.position.z = 0.0085;
    const back = new THREE.Mesh(face.clone(), new THREE.MeshPhysicalMaterial({
      map: canvasTexture(drawCardBack), roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15
    }));
    back.rotation.y = Math.PI;
    back.position.z = -0.0085;
    // rainbow hologram patch that shifts colour as the card turns
    const hologram = new THREE.Mesh(new THREE.CircleGeometry(0.15, 48), new THREE.MeshPhysicalMaterial({
      color: 0xe4dcff, metalness: 0.55, roughness: 0.25, iridescence: 1, iridescenceIOR: 2,
      iridescenceThicknessRange: [250, 900], clearcoat: 1
    }));
    hologram.position.set(0.56, -0.27, 0.0095);
    card.add(body, front, back, hologram);
    scene.add(card);

    const tilt = { x: 0, y: 0 };
    function draw(time) {
      if (!fitRenderer(renderer, camera, canvas)) return;
      const t = reduceMotion ? 0 : time / 1000;
      const scroll = Math.min(scrollY / innerHeight, 1.2);
      tilt.x += (pointer.y - tilt.x) * 0.05;
      tilt.y += (pointer.x - tilt.y) * 0.05;
      card.rotation.set(0.12 + tilt.x * 0.35 + scroll * 0.6, -0.5 + tilt.y * 0.55 + Math.sin(t * 0.5) * 0.12, -0.08 + scroll * 0.3);
      card.position.set(0.12, Math.sin(t * 0.8) * 0.06 + scroll * 0.9, 0);
      renderer.render(scene, camera);
    }
    if (reduceMotion) {
      addEventListener('resize', () => draw(0));
      document.fonts?.ready.then(() => draw(0));
      draw(0);
    } else {
      whileVisible(canvas, draw);
    }
  }

  if (matchMedia('(min-width: 901px)').matches) heroCard(document.getElementById('heroCard'));

  /* ---------- Exploded document reader ---------- */

  function buildReader() {
    const graphite = new THREE.MeshStandardMaterial({ color: 0x41445a, roughness: 0.36, metalness: 0.45 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1d1f29, roughness: 0.45, metalness: 0.35 });
    const aluminium = new THREE.MeshStandardMaterial({ color: 0xb8bcc8, roughness: 0.28, metalness: 0.95 });
    const copper = new THREE.MeshStandardMaterial({ color: 0xd08a4a, roughness: 0.3, metalness: 1 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xe0b44a, roughness: 0.3, metalness: 1 });
    const glow = hex => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 2.4 });

    const reader = new THREE.Group();
    const parts = [];
    // key, object, assembled y, exploded y, label anchor half-width
    const add = (key, object, y0, y1, halfWidth) => {
      object.position.y = y0;
      reader.add(object);
      const box = new THREE.Box3().setFromObject(object);
      parts.push({ key, object, y0, y1, halfWidth, top: box.max.y - y0, bottom: box.min.y - y0 });
    };

    const passport = new THREE.Group();
    const cover = new THREE.MeshStandardMaterial({ color: 0x5a1733, roughness: 0.75 });
    const pages = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.035, 1.38), new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.9 }));
    const coverL = new THREE.Mesh(new THREE.BoxGeometry(1.03, 0.02, 1.45), cover);
    const coverR = coverL.clone();
    coverL.position.set(-0.525, 0.027, 0);
    coverR.position.set(0.525, 0.027, 0);
    const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.16, 40), gold);
    emblem.rotation.x = -Math.PI / 2;
    emblem.position.set(0.525, 0.038, -0.12);
    passport.add(pages, coverL, coverR, emblem);
    add('document', passport, 0.98, 5.0, 1.05);

    const lid = new THREE.Mesh(roundedBox(2.9, 0.32, 2.2, 0.08), graphite);
    add('lid', lid, 1.13, 4.15, 1.45);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 1.7), new THREE.MeshPhysicalMaterial({
      color: 0xbfd2ff, transparent: true, opacity: 0.3, roughness: 0.04, metalness: 0, clearcoat: 1, side: THREE.DoubleSide
    }));
    add('glass', glass, 0.93, 3.3, 1.2);

    const rfid = new THREE.Group();
    [1, 0.88, 0.76].forEach(s => {
      const points = roundedRectShape(2.1 * s, 1.45 * s, 0.18 * s).getPoints(24).map(p => new THREE.Vector3(p.x, 0, p.y));
      rfid.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 160, 0.016, 6, true), copper));
    });
    const rfidChip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.22), dark);
    rfidChip.position.set(0.95, 0, 0.62);
    rfid.add(rfidChip);
    add('rfid', rfid, 0.85, 2.55, 1.1);

    const light = new THREE.Group();
    const bar = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), aluminium);
      m.position.set(x, 0, z);
      light.add(m);
    };
    bar(2.5, 0.1, 0, -0.85);
    bar(2.5, 0.1, 0, 0.85);
    bar(0.1, 1.8, -1.2, 0);
    bar(0.1, 1.8, 1.2, 0);
    const ledColors = [0xffffff, 0xff3355, 0x8a5cff];
    for (let i = 0; i < 9; i++) {
      [-0.78, 0.78].forEach((z, j) => {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.05), glow(ledColors[(i + j) % 3]));
        led.position.set(-1 + i * 0.25, 0.03, z);
        light.add(led);
      });
    }
    add('light', light, 0.77, 1.85, 1.25);

    const camera = new THREE.Group();
    const camBody = new THREE.Mesh(roundedBox(0.7, 0.32, 0.5, 0.05), dark);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.28, 40), new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.25, metalness: 0.9 }));
    barrel.position.y = 0.3;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.018, 12, 40), aluminium);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.44;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.13, 40), new THREE.MeshPhysicalMaterial({ color: 0x2a3cff, emissive: 0x2236ff, emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.2, clearcoat: 1 }));
    lens.rotation.x = -Math.PI / 2;
    lens.position.y = 0.442;
    camera.add(camBody, barrel, ring, lens);
    add('camera', camera, 0.36, 1.05, 0.36);

    const board = new THREE.Group();
    board.add(new THREE.Mesh(roundedBox(2.7, 0.05, 1.9, 0.02), new THREE.MeshStandardMaterial({ color: 0x0f3d36, roughness: 0.6, metalness: 0.2 })));
    [[-0.8, -0.4, 0.45, 0.45], [0.7, 0.35, 0.6, 0.35], [-0.2, 0.55, 0.3, 0.3], [0.9, -0.55, 0.25, 0.5], [-1.0, 0.5, 0.2, 0.2]].forEach(([x, z, w, d]) => {
      const chip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), dark);
      chip.position.set(x, 0.05, z);
      board.add(chip);
    });
    const traces = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.01, 0.02), gold);
    traces.position.set(0, 0.03, -0.1);
    board.add(traces);
    add('board', board, 0.12, 0.25, 1.35);

    const base = new THREE.Group();
    base.add(new THREE.Mesh(roundedBox(3.2, 0.9, 2.4, 0.12), graphite));
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.03, 0.01), glow(0x7b4fe0));
    strip.position.set(0, 0.22, 1.201);
    base.add(strip);
    add('base', base, 0.45, -0.95, 1.6);

    return { reader, parts };
  }

  function explodedReader(section) {
    const canvas = section.querySelector('canvas');
    const renderer = makeRenderer(canvas);
    if (!renderer) return;
    const scene = new THREE.Scene();
    scene.environment = makeEnvironment(renderer);
    scene.add(new THREE.HemisphereLight(0xc9bfff, 0x1a1640, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(3, 6, 4);
    const rim = new THREE.DirectionalLight(0xa985ff, 2.5);
    rim.position.set(-5, 2, -4);
    scene.add(key, rim);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const { reader, parts } = buildReader();
    scene.add(reader);

    const labels = new Map([...section.querySelectorAll('[data-part]')].map(el => [el.dataset.part, el]));
    const anchor = new THREE.Vector3();
    const center = new THREE.Vector3();
    const target = new THREE.Vector3();
    const tilt = { x: 0, y: 0 };
    const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

    function draw() {
      if (!fitRenderer(renderer, camera, canvas)) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const wide = w > 900;

      const rect = section.getBoundingClientRect();
      const p = clamp(-rect.top / (rect.height - innerHeight), 0, 1);
      // apart in the first half, hold, back together at the end
      const e = smooth(0.06, 0.5, p) * (1 - smooth(0.82, 0.98, p));

      tilt.x += (pointer.y - tilt.x) * 0.05;
      tilt.y += (pointer.x - tilt.y) * 0.05;
      reader.rotation.y = lerp(-0.9, 0.55, p) + tilt.y * 0.12;
      reader.rotation.x = tilt.x * 0.05;

      parts.forEach((part, i) => {
        const k = smooth(i * 0.055, 0.55 + i * 0.055, e);
        part.object.position.y = lerp(part.y0, part.y1, k);
        if (part.key === 'lid') part.object.rotation.x = -0.3 * k;
        if (part.key === 'document') part.object.rotation.z = 0.12 * k;
        part.k = k;
      });

      // frame the whole stack: on wide screens right of the copy, on phones below it
      const top = Math.max(...parts.map(part => part.object.position.y + part.top));
      const bottom = Math.min(...parts.map(part => part.object.position.y + part.bottom));
      const room = wide ? { w: w * 0.62, h } : { w: w * 0.62, h: h * 0.66 };
      const needH = top - bottom + 0.9;
      const needW = wide ? 5.4 : lerp(4.9, 3.7, e);
      const dist = Math.max(needH / (2 * halfFov), needW / (2 * halfFov * (room.w / room.h))) * (h / room.h);
      const elevation = 0.48;
      target.set(0, (top + bottom) / 2, 0);
      camera.position.set(0, target.y + Math.sin(elevation) * dist, Math.cos(elevation) * dist);
      camera.lookAt(target);
      if (wide) camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
      // on phones the model moves left so every label fits on its right
      else camera.setViewOffset(w, h, w * 0.19 * e, -h * 0.1, w, h);
      camera.updateMatrixWorld();

      parts.forEach(part => {
        const label = labels.get(part.key);
        if (!label) return;
        const visible = smooth(0.75, 0.97, part.k);
        label.style.opacity = visible;
        if (!visible) return;
        part.object.getWorldPosition(center);
        anchor.set(part.halfWidth, 0, 0);
        part.object.localToWorld(anchor);
        // pick whichever end of the part is further out on screen
        center.project(camera);
        anchor.project(camera);
        const right = !wide || anchor.x >= center.x;
        if (!right) {
          anchor.set(-part.halfWidth, 0, 0);
          part.object.localToWorld(anchor);
          anchor.project(camera);
        }
        const x = (anchor.x * 0.5 + 0.5) * w;
        const y = (-anchor.y * 0.5 + 0.5) * h;
        label.classList.toggle('xp-label--left', !right);
        label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });

      renderer.render(scene, camera);
    }
    whileVisible(section, draw);
  }

  const explode = document.getElementById('explode');
  if (explode) explodedReader(explode);
})();
