(() => {
  const canvas = document.getElementById("particles");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d11);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 2, 6);

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const COUNT = 900;
  const SPAWN_HEIGHT = 8;
  const DESPAWN_Y = -6;
  const AREA_XZ = 10;
  const GRAVITY = 4.5;
  const RAMP_DURATION = 15; // seconds to reach full rain rate
  const positions = new Float32Array(COUNT * 3);
  const velX = new Float32Array(COUNT);
  const velY = new Float32Array(COUNT);
  const velZ = new Float32Array(COUNT);
  const respawnTimers = new Float32Array(COUNT);
  let activation = 0;
  let activeCount = 0;
  let mode = "rain";

  function respawnRain(i) {
    const idx = i * 3;
    positions[idx + 0] = (Math.random() - 0.5) * AREA_XZ;
    positions[idx + 1] = SPAWN_HEIGHT + Math.random() * 6;
    positions[idx + 2] = (Math.random() - 0.5) * AREA_XZ;
    velX[i] = 0;
    velY[i] = 0.6 + Math.random() * 0.9;
    velZ[i] = 0;
    respawnTimers[i] = 0;
  }

  function initRain() {
    activation = 0;
    activeCount = 0;
    for (let i = 0; i < COUNT; i++) {
      respawnRain(i);
      respawnTimers[i] = Math.random() * 1.5;
    }
  }

  initRain();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0x66ccff,
    size: 0.05,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);

    activation = Math.min(1, activation + delta / RAMP_DURATION);
    const targetActive = Math.max(1, Math.floor(COUNT * activation));
    if (targetActive > activeCount) {
      for (let i = activeCount; i < targetActive; i++) {
        respawnRain(i);
        respawnTimers[i] = Math.random() * 1.5;
      }
      activeCount = targetActive;
    }

    for (let i = 0; i < activeCount; i++) {
      if (respawnTimers[i] > 0) {
        respawnTimers[i] -= delta;
        continue;
      }
      const idx = i * 3;
      velY[i] += GRAVITY * delta;
      positions[idx + 1] -= velY[i] * delta;
      positions[idx + 0] += (Math.random() - 0.5) * 0.01;
      positions[idx + 2] += (Math.random() - 0.5) * 0.01;
      if (positions[idx + 1] < DESPAWN_Y) {
        positions[idx + 1] = DESPAWN_Y;
        respawnTimers[i] = Math.random() * 0.6;
        continue;
      }
    }
    for (let i = 0; i < activeCount; i++) {
      if (respawnTimers[i] <= 0 && positions[i * 3 + 1] <= DESPAWN_Y) {
        respawnRain(i);
      }
    }

    geometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener("resize", () => {
    const { innerWidth, innerHeight } = window;
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });
})();
