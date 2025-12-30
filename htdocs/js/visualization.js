(() => {
  const canvas = document.getElementById("vis-canvas");
  const statusEl = document.getElementById("status");
  const startBtn = document.getElementById("start-btn");
  const testBtn = document.getElementById("test-burst-btn");
  const thresholdInput = document.getElementById("threshold");
  const thresholdValue = document.getElementById("threshold-value");
  const meterFill = document.getElementById("meter-fill");
  const meterValue = document.getElementById("meter-value");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d11);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 2.5, 7);

  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  const dir = new THREE.DirectionalLight(0xffffff, 0.5);
  dir.position.set(5, 8, 3);
  scene.add(ambient, dir);

  const COUNT = 800;
  const BURST_SIZE = 200;
  const BURST_LIFE = 2.0;
  const DRAG = 1.4;
  const AREA_XZ = 10;

  const positions = new Float32Array(COUNT * 3);
  const velX = new Float32Array(COUNT);
  const velY = new Float32Array(COUNT);
  const velZ = new Float32Array(COUNT);
  const life = new Float32Array(COUNT);
  let poolIndex = 0;

  function spawnParticle(i, origin) {
    const idx = i * 3;
    positions[idx + 0] = origin.x;
    positions[idx + 1] = origin.y;
    positions[idx + 2] = origin.z;
    const speed = 3 + Math.random() * 4;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    velX[i] = Math.cos(theta) * Math.sin(phi) * speed;
    velZ[i] = Math.sin(theta) * Math.sin(phi) * speed;
    velY[i] = Math.cos(phi) * speed;
    life[i] = BURST_LIFE;
  }

  function clearParticle(i) {
    const idx = i * 3;
    positions[idx + 0] = positions[idx + 1] = positions[idx + 2] = -999;
    velX[i] = velY[i] = velZ[i] = 0;
    life[i] = 0;
  }

  for (let i = 0; i < COUNT; i++) clearParticle(i);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 50);

  const material = new THREE.PointsMaterial({
    color: 0x66ccff,
    size: 0.12,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  function triggerBurst() {
    const origin = {
      x: (Math.random() - 0.5) * AREA_XZ * 0.8,
      y: 0.2 + Math.random() * 1.2,
      z: (Math.random() - 0.5) * AREA_XZ * 0.8
    };
    for (let n = 0; n < BURST_SIZE; n++) {
      spawnParticle(poolIndex, origin);
      poolIndex = (poolIndex + 1) % COUNT;
    }
  }

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    const drag = Math.exp(-DRAG * delta);
    let maxFade = 0;

    for (let i = 0; i < COUNT; i++) {
      if (life[i] <= 0) continue;
      const idx = i * 3;
      velX[i] *= drag;
      velY[i] *= drag;
      velZ[i] *= drag;
      positions[idx + 0] += velX[i] * delta;
      positions[idx + 1] += velY[i] * delta;
      positions[idx + 2] += velZ[i] * delta;
      life[i] -= delta;
      const fade = Math.max(0, life[i] / BURST_LIFE);
      if (fade > maxFade) maxFade = fade;
      if (life[i] <= 0) clearParticle(i);
    }

    material.opacity = maxFade > 0 ? Math.pow(maxFade, 2) * 0.9 : 0.9;
    geometry.attributes.position.needsUpdate = true;
    geometry.computeBoundingSphere();
    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener("resize", () => {
    const { innerWidth, innerHeight } = window;
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });

  // Audio handling
  let audioCtx;
  let analyser;
  let freqData;
  let listening = false;
  let lastHit = 0;
  let hitThreshold = thresholdInput ? Number(thresholdInput.value) || 100 : 100;
  let lastSignalTime = 0;
  let sampleRate = 44100;
  let lastPeakValue = 0;

  function updateStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function updateThresholdDisplay() {
    if (thresholdValue) thresholdValue.textContent = hitThreshold.toFixed(0);
  }

  updateThresholdDisplay();

  async function startAudio() {
    if (listening) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
      sampleRate = audioCtx.sampleRate;
      await audioCtx.resume();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      freqData = new Uint8Array(analyser.frequencyBinCount);
      listening = true;
      updateStatus("Listening... play bass to trigger bursts.");
      monitorAudio();
    } catch (err) {
      console.error(err);
      updateStatus("Microphone blocked or unavailable.");
    }
  }

  function monitorAudio() {
    if (!listening || !analyser) return;
    analyser.getByteFrequencyData(freqData);
    let peak = 0;
    let peakIndex = 0;
    for (let i = 0; i < freqData.length; i++) {
      if (freqData[i] > peak) {
        peak = freqData[i];
        peakIndex = i;
      }
    }

    if (meterFill) {
      const pct = Math.min(100, (peak / 255) * 100);
      meterFill.style.width = `${pct}%`;
    }
    if (meterValue) {
      meterValue.textContent = peak.toFixed(1);
    }

    const now = performance.now();
    if (peak > 2) {
      lastSignalTime = now;
      updateStatus(`Signal peak ${peak.toFixed(1)} / threshold ${hitThreshold}`);
    } else if (now - lastSignalTime > 2000) {
      updateStatus("No input signal detected. Check mic/loopback and permissions.");
    }

    const silentTooLong = now - lastSignalTime > 350;
    if (!silentTooLong && peak > hitThreshold && now - lastHit > 90) {
      triggerBurst();
      lastHit = now;
      updateStatus(`Burst! peak ${peak.toFixed(1)} / threshold ${hitThreshold}`);
    }
    lastPeakValue = peak;

    requestAnimationFrame(monitorAudio);
  }

  if (startBtn) {
    startBtn.addEventListener("click", startAudio);
  }

  if (testBtn) {
    testBtn.addEventListener("click", () => {
      triggerBurst();
      updateStatus("Manual burst triggered.");
    });
  }

  if (thresholdInput) {
    thresholdInput.addEventListener("input", (e) => {
      const val = Number(e.target.value);
      if (!Number.isNaN(val)) {
        hitThreshold = val;
        updateThresholdDisplay();
      }
    });
  }

})();
