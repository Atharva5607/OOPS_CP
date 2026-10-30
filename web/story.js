/* Cinematic WebGL scrollytelling for the landing page (Three.js r160).
   One GPU particle field is morphed by scroll progress through five chapters:
   void -> attack streams -> shield -> breach (one red color-pop) -> calm verdict.
   Returns a cleanup function; the router calls it when leaving the landing page. */
function initStory(canvas, chapters, dots) {
  if (!window.THREE) return () => {};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch { canvas.remove(); return () => {}; }  // no WebGL: the CSS background still works

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
  const N = innerWidth < 700 ? 3500 : 9000;

  // ---- particles: all motion lives in the vertex shader ----
  const seed = new Float32Array(N * 4);
  for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const uni = { uTime: { value: 0 }, uP: { value: 0 }, uBreach: { value: 0 }, uAxis: { value: new THREE.Vector3(1, 0, 0) }, uSize: { value: 2.6 * renderer.getPixelRatio() } };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime, uP, uBreach, uSize; uniform vec3 uAxis; attribute vec4 aSeed; varying vec3 vCol; varying float vA;
      const vec3 GOLD = vec3(1., .70, .30), CYAN = vec3(.31, .76, 1.), VIOLET = vec3(.54, .42, 1.), RED = vec3(1., .16, .16), BONE = vec3(.96, .95, .92);
      void main() {
        float th = aSeed.x * 6.2831853, ph = acos(2. * aSeed.y - 1.);
        vec3 d = vec3(sin(ph) * cos(th), cos(ph), sin(ph) * sin(th));
        float t = uTime;
        float s1 = smoothstep(.16, .28, uP), s2 = smoothstep(.42, .54, uP), s3 = smoothstep(.78, .88, uP);
        float wA = 1. - s1, wB = s1 * (1. - s2), wC = s2 * (1. - s3), wD = s3;     // weights always sum to 1
        vec3 pA = d * (5. + aSeed.z * 9.) + vec3(sin(t * .2 + aSeed.w * 30.), cos(t * .17 + aSeed.z * 20.), sin(t * .13 + aSeed.x * 25.)) * .7;
        float f = fract(t * (.10 + aSeed.w * .16) + aSeed.z);
        vec3 pB = d * mix(14., 2.5, f * f);                                           // attack: streams falling inward
        vec3 pC = d * (aSeed.w > .5 ? 2.6 : 3.4);                                    // defense: two shield shells
        vec3 pD = d * (3. + .18 * sin(t * .8 + aSeed.z * 10.));                       // verdict: calm breathing sphere
        vec3 p = pA * wA + pB * wB + pC * wC + pD * wD;
        float cone = step(.72, dot(d, uAxis));                                        // the breach wedge, always facing the camera
        p += d * uBreach * cone * (1. + aSeed.z * 5.) + vec3(0., sin(t * 9. + aSeed.x * 50.), 0.) * uBreach * cone * .15;
        vec3 col = GOLD * (wA + wB + wD) + mix(CYAN, VIOLET, aSeed.z) * wC;
        col = mix(col, BONE, step(.975, aSeed.y));
        col = mix(col, RED, clamp(uBreach * 1.4, 0., 1.) * cone);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (.5 + aSeed.w) * (26. / -mv.z);
        vCol = col; vA = .55 + .45 * aSeed.z;
      }`,
    fragmentShader: `
      varying vec3 vCol; varying float vA;
      void main() { float r = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., r); gl_FragColor = vec4(vCol, a * a * vA); }`,
  }));
  const stage = new THREE.Group();  // moved sideways so the object never sits behind the text
  stage.add(points);
  scene.add(stage);

  // ---- core wireframe and shield rings ----
  const wire = (g, c) => new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  const core = wire(new THREE.IcosahedronGeometry(1.25, 1), 0xffb24d);
  const rings = [2.6, 3.4].map((r, i) => { const m = wire(new THREE.TorusGeometry(r, 0.006, 6, 160), 0x4fc3ff); m.rotation.x = 1.2 + i * 0.5; m.material.opacity = 0; return m; });
  stage.add(core, ...rings);

  // ---- camera path (scroll progress -> z), parallax, smoothing ----
  const path = [[0, 13], [0.28, 9], [0.5, 7], [0.72, 8], [1, 11.5]];
  const camZ = (p) => { for (let i = 1; i < path.length; i++) if (p <= path[i][0]) { const [a, za] = path[i - 1], [b, zb] = path[i]; const k = (p - a) / (b - a); return za + (zb - za) * k * k * (3 - 2 * k); } return path[path.length - 1][1]; };
  let target = 0, cur = 0, mx = 0, my = 0, raf = 0;
  const onScroll = () => { target = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight); };
  const onMove = (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('pointermove', onMove); addEventListener('resize', resize);
  resize(); onScroll();

  // ---- chapter text reveal + progress rail ----
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    e.target.classList.toggle('in', e.isIntersecting);
    if (e.isIntersecting && e.intersectionRatio > 0.3) dots.forEach((d, i) => d.classList.toggle('on', i === chapters.indexOf(e.target)));
  }), { threshold: [0.15, 0.4] });
  chapters.forEach((c) => io.observe(c));

  const clock = new THREE.Clock();
  const frame = () => {
    if (!canvas.isConnected) return cleanup();
    raf = requestAnimationFrame(frame);
    const dt = clock.getDelta();
    cur += (target - cur) * Math.min(1, dt * 3.2);
    if (!reduce) uni.uTime.value += dt;
    uni.uP.value = cur;
    uni.uBreach.value = Math.exp(-(((cur - 0.75) / 0.04) ** 2));
    const wC = Math.min(1, Math.max(0, (cur - 0.44) / 0.1)) * (1 - Math.min(1, Math.max(0, (cur - 0.78) / 0.08)));
    rings.forEach((r, i) => { r.material.opacity = wC * 0.35; r.rotation.z += dt * (0.15 + i * 0.1); });
    core.material.color.setHex(cur > 0.44 && cur < 0.8 ? 0x4fc3ff : 0xffb24d);
    core.rotation.y += dt * 0.25; core.rotation.x += dt * 0.1;
    stage.position.x = innerWidth > 760 ? 2.7 * Math.cos(cur * Math.PI * 4) : 0;  // chapter centers sit at p = 0, .25, .5, .75, 1; text alternates left/right
    points.rotation.y = cur * 2.4 + uni.uTime.value * 0.03;
    uni.uAxis.value.set(1, 0.1, 0.5).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), -points.rotation.y);
    camera.position.set(mx * 1.4, -my * 0.9 + 0.5, camZ(cur));
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  function cleanup() {
    cancelAnimationFrame(raf); io.disconnect();
    removeEventListener('scroll', onScroll); removeEventListener('pointermove', onMove); removeEventListener('resize', resize);
    geo.dispose(); points.material.dispose(); renderer.dispose();
  }
  return cleanup;
}
