/**
 * MorphingDots
 * Lightweight helper that renders a matrix of particles using THREE.js and morphs
 * them between predefined 3D shapes. The library exposes a simple API:
 *    const morph = new MorphingDots({ container: '#hero-animation-canvas' });
 *    morph.morphTo('sphere');
 *
 * Shapes are defined as Float32Array keyframes. Morphing is achieved by
 * interpolating the BufferGeometry position attribute toward the active keyframe.
 */
(function () {
    if (typeof THREE === 'undefined') {
        console.warn('MorphingDots: THREE.js is required before this script runs.');
        return;
    }

    class MorphingDots {
        constructor(options = {}) {
            const defaults = {
                container: '#hero-animation-canvas',
                pointColor: '#f5ff1a',
                pointSize: 1.3,
                cameraZ: 110,
                particleCount: 400,
            };
            this.config = Object.assign({}, defaults, options);
            this.container = typeof this.config.container === 'string'
                ? document.querySelector(this.config.container)
                : this.config.container;

            if (!this.container) {
                console.warn('MorphingDots: container not found.');
                return;
            }

            this.particleCount = this.config.particleCount;
            this.targetPositions = null;
            this.activeShape = null;
            this.wavePhase = 0;
            this.resizeObserver = null;
            this.clock = new THREE.Clock();

            this._initScene();
            this._createParticles();
            this._buildShapeLibrary();
            this.morphTo('scatter');

            this._animate = this._animate.bind(this);
            requestAnimationFrame(this._animate);
            this._bindResize();
            this._bindMouseControls();
        }

        _initScene() {
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(
                60,
                this._containerAspect(),
                0.1,
                1000
            );
            this.camera.position.z = this.config.cameraZ;

            this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            this.renderer.setPixelRatio(window.devicePixelRatio || 1);
            this._setRendererSize();
            this.renderer.domElement.style.position = 'absolute';
            this.renderer.domElement.style.top = '0';
            this.renderer.domElement.style.left = '0';
            this.renderer.domElement.style.width = '100%';
            this.renderer.domElement.style.height = '100%';
            this.renderer.domElement.style.pointerEvents = 'none';
            this.container.appendChild(this.renderer.domElement);

            const ambient = new THREE.AmbientLight(0xffffff, 0.9);
            this.scene.add(ambient);
        }

        _createParticles() {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(this.particleCount * 3);
            for (let i = 0; i < this.particleCount; i += 1) {
                positions[i * 3] = (Math.random() - 0.5) * 110;
                positions[i * 3 + 1] = (Math.random() - 0.5) * 110;
                positions[i * 3 + 2] = (Math.random() - 0.5) * 110;
            }
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const dotTexture = this._createDotTexture();
            const material = new THREE.PointsMaterial({
                size: this.config.pointSize,
                map: dotTexture,
                transparent: true,
                depthWrite: false,
                alphaTest: 0.05,
                opacity: 0.95,
            });

            this.points = new THREE.Points(geometry, material);
            this.scene.add(this.points);
            this.geometry = geometry;
            this.autoRotation = { x: 0, y: 0 };
            this.mouseRotation = {
                currentX: 0,
                currentY: 0,
                targetX: 0,
                targetY: 0,
            };
        }

        _createDotTexture() {
            const size = 64;
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            const gradient = ctx.createRadialGradient(
                size / 2,
                size / 2,
                size * 0.1,
                size / 2,
                size / 2,
                size / 2
            );
            gradient.addColorStop(0, 'rgba(60, 120, 255, 1)');
            gradient.addColorStop(0.4, 'rgba(40, 80, 200, 0.8)');
            gradient.addColorStop(1, 'rgba(8, 20, 60, 0)');

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);

            const texture = new THREE.Texture(canvas);
            texture.needsUpdate = true;
            return texture;
        }

        _buildShapeLibrary() {
            this.shapes = {
                grid: this._generateGridPositions(),
                sphere: this._generateSpherePositions(),
                helix: this._generateHelixPositions(),
                wave: this._generateWavePositions(0),
                spiralshell: this._generateSpiralShellPositions(),
                envelope: this._generateEnvelopePositions(),
                cube: this._generateCubePositions(),
            };
        }

        _generateScatterPositions() {
            const spread = 130;
            const positions = new Float32Array(this.particleCount * 3);
            for (let i = 0; i < this.particleCount; i += 1) {
                positions[i * 3] = (Math.random() - 0.5) * spread;
                positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
                positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
            }
            return positions;
        }

        morphTo(shapeName) {
            if (shapeName === 'scatter') {
                this.targetPositions = this._generateScatterPositions();
                this.activeShape = shapeName;
                return;
            }
            if (!this.shapes || !this.shapes[shapeName]) {
                console.warn(`MorphingDots: shape "${shapeName}" not found.`);
                return;
            }
            if (this.targetPositions === this.shapes[shapeName]) {
                this.activeShape = shapeName;
                return;
            }
            this.activeShape = shapeName;
            this.targetPositions = this.shapes[shapeName];
            if (shapeName === 'wave') {
                this.wavePhase = 0;
            }
        }

        dispose() {
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }
            if (this._boundResize) {
                window.removeEventListener('resize', this._boundResize);
            }
            if (this._handleMouseMove) {
                window.removeEventListener('mousemove', this._handleMouseMove);
            }
            if (this._handleMouseLeave) {
                window.removeEventListener('mouseleave', this._handleMouseLeave);
            }
            if (this.renderer) {
                this.renderer.dispose();
            }
        }

        _generateGridPositions() {
            const positions = new Float32Array(this.particleCount * 3);
            const columns = Math.round(Math.sqrt(this.particleCount));
            const rows = Math.ceil(this.particleCount / columns);
            const width = 130;
            const height = 75;

            for (let i = 0; i < this.particleCount; i += 1) {
                const col = i % columns;
                const row = Math.floor(i / columns);
                const x = (col / (columns - 1) - 0.5) * width;
                const y = (row / (rows - 1) - 0.5) * height;
                positions[i * 3] = x;
                positions[i * 3 + 1] = y;
                positions[i * 3 + 2] = 0;
            }
            return positions;
        }

        _generateSpherePositions() {
            const positions = new Float32Array(this.particleCount * 3);
            const radius = 46;
            const offset = 2 / this.particleCount;
            const increment = Math.PI * (3 - Math.sqrt(5));

            for (let i = 0; i < this.particleCount; i += 1) {
                const y = i * offset - 1 + offset / 2;
                const r = Math.sqrt(1 - y * y);
                const phi = i * increment;
                positions[i * 3] = Math.cos(phi) * r * radius;
                positions[i * 3 + 1] = y * radius;
                positions[i * 3 + 2] = Math.sin(phi) * r * radius;
            }
            return positions;
        }

        _generateHelixPositions() {
            const positions = new Float32Array(this.particleCount * 3);
            const turns = 4.5;
            const height = 105;
            const radius = 24;

            for (let i = 0; i < this.particleCount; i += 1) {
                const t = (i / this.particleCount) * Math.PI * 2 * turns;
                const y = (i / this.particleCount - 0.5) * height;
                positions[i * 3] = Math.cos(t) * radius;
                positions[i * 3 + 1] = y;
                positions[i * 3 + 2] = Math.sin(t) * radius;
            }
            return positions;
        }

        _generateWavePositions(phase = 0) {
            const positions = new Float32Array(this.particleCount * 3);
            const columns = Math.round(Math.sqrt(this.particleCount));
            const rows = Math.ceil(this.particleCount / columns);
            const width = 130;
            const depth = 95;

            for (let i = 0; i < this.particleCount; i += 1) {
                const col = i % columns;
                const row = Math.floor(i / columns);
                const xRatio = col / (columns - 1) - 0.5;
                const zRatio = row / (rows - 1) - 0.5;
                const x = xRatio * width;
                const z = zRatio * depth;
                const y = Math.sin(xRatio * Math.PI * 4 + phase) * 12 + Math.cos(zRatio * Math.PI * 4 + phase * 0.7) * 12;
                positions[i * 3] = x;
                positions[i * 3 + 1] = y;
                positions[i * 3 + 2] = z;
            }
            return positions;
        }

        _generateSpiralShellPositions() {
            const positions = new Float32Array(this.particleCount * 3);
            const coils = 6;
            const height = 140;
            const radius = 20;
            for (let i = 0; i < this.particleCount; i += 1) {
                const t = i / this.particleCount;
                const angle = coils * Math.PI * 2 * t;
                const expandingRadius = radius + t * 70;
                const x = Math.cos(angle) * expandingRadius;
                const y = -height / 2 + t * height;
                const z = Math.sin(angle) * expandingRadius;
                const jitter = (1 - t * 0.3);
                positions[i * 3] = x + (Math.random() - 0.5) * 4 * jitter;
                positions[i * 3 + 1] = y + (Math.random() - 0.5) * 4 * jitter;
                positions[i * 3 + 2] = z + (Math.random() - 0.5) * 4 * jitter;
            }
            return positions;
        }

        _generateEnvelopePositions() {
            const positions = new Float32Array(this.particleCount * 3);
            let ptr = 0;
            const add = (x, y, z, jitter = 1.5) => {
                if (ptr >= positions.length) return;
                positions[ptr] = x + (Math.random() - 0.5) * jitter;
                positions[ptr + 1] = y + (Math.random() - 0.5) * jitter;
                positions[ptr + 2] = z + (Math.random() - 0.5) * jitter;
                ptr += 3;
            };

            const width = 150;
            const height = 90;
            const depth = 8;

            const outlineCount = Math.floor(this.particleCount * 0.4);
            for (let i = 0; i < outlineCount && ptr < positions.length; i += 1) {
                const t = i / outlineCount;
                add(-width / 2 + t * width, height / 2, (Math.random() - 0.5) * depth);
                add(-width / 2 + t * width, -height / 2, (Math.random() - 0.5) * depth);
            }

            const sideCount = Math.floor(this.particleCount * 0.25);
            for (let i = 0; i < sideCount && ptr < positions.length; i += 1) {
                const t = i / sideCount;
                add(-width / 2, height / 2 - t * height, (Math.random() - 0.5) * depth);
                add(width / 2, -height / 2 + t * height, (Math.random() - 0.5) * depth);
            }

            const flapCount = Math.floor(this.particleCount * 0.25);
            for (let i = 0; i < flapCount && ptr < positions.length; i += 1) {
                const t = i / flapCount;
                const x = -width / 2 + t * width;
                const y = height / 2 - Math.abs(t - 0.5) * height;
                add(x, y, (Math.random() - 0.5) * depth);
            }

            while (ptr < positions.length) {
                add((Math.random() - 0.5) * width * 0.6, (Math.random() - 0.5) * height * 0.6, (Math.random() - 0.5) * depth);
            }

            return positions;
        }

        _generateCubePositions() {
            const positions = new Float32Array(this.particleCount * 3);
            const size = 70;
            let ptr = 0;

            const add = (x, y, z) => {
                if (ptr >= positions.length) return;
                positions[ptr] = x;
                positions[ptr + 1] = y;
                positions[ptr + 2] = z;
                ptr += 3;
            };

            const half = size / 2;
            const faceParticles = Math.ceil(this.particleCount / 6);
            const gridCount = Math.max(6, Math.floor(Math.sqrt(faceParticles)));
            const step = size / (gridCount - 1);
            const gridPoints = [];
            const faces = [
                (u, v) => [-half + u, -half + v, half],
                (u, v) => [-half + u, -half + v, -half],
                (u, v) => [half, -half + u, -half + v],
                (u, v) => [-half, -half + u, -half + v],
                (u, v) => [-half + u, half, -half + v],
                (u, v) => [-half + u, -half, -half + v],
            ];

            faces.forEach(face => {
                for (let i = 0; i < gridCount && ptr < positions.length; i += 1) {
                    for (let j = 0; j < gridCount && ptr < positions.length; j += 1) {
                        const point = face(i * step, j * step);
                        add(point[0], point[1], point[2]);
                        gridPoints.push(point);
                    }
                }
            });

            while (ptr < positions.length) {
                const point = gridPoints[ptr / 3 % gridPoints.length];
                add(point[0], point[1], point[2]);
            }

            return positions;
        }




        _bindMouseControls() {
            const mapRange = (value, max, scale) => ((value / max) * 2 - 1) * scale;
            this._handleMouseMove = (event) => {
                const width = window.innerWidth || this.container.clientWidth || 1;
                const height = window.innerHeight || this.container.clientHeight || 1;
                this.mouseRotation.targetX = mapRange(event.clientX, width, 0.35);
                this.mouseRotation.targetY = mapRange(event.clientY, height, 0.25);
            };
            this._handleMouseLeave = () => {
                this.mouseRotation.targetX = 0;
                this.mouseRotation.targetY = 0;
            };
            window.addEventListener('mousemove', this._handleMouseMove);
            window.addEventListener('mouseleave', this._handleMouseLeave);
        }

        _animate() {
            if (!this.renderer) {
                return;
            }
            requestAnimationFrame(this._animate);
            const delta = this.clock.getDelta();

            this._updateAnimatedShapes(delta);

            if (this.targetPositions) {
                const current = this.geometry.attributes.position.array;
                const morphSpeed = 0.07; // slightly faster interpolation toward target shape
                for (let i = 0; i < current.length; i += 1) {
                    const target = this.targetPositions[i];
                    current[i] += (target - current[i]) * morphSpeed;
                }
                this.geometry.attributes.position.needsUpdate = true;
            }

            this.autoRotation.y += delta * 0.08;
            this.autoRotation.x += delta * 0.02;
            this.mouseRotation.currentX += (this.mouseRotation.targetX - this.mouseRotation.currentX) * 0.06;
            this.mouseRotation.currentY += (this.mouseRotation.targetY - this.mouseRotation.currentY) * 0.06;

            if (this.points) {
                this.points.rotation.y = this.autoRotation.y + this.mouseRotation.currentX;
                this.points.rotation.x = this.autoRotation.x * 0.2 + this.mouseRotation.currentY;
            }

            this.renderer.render(this.scene, this.camera);
        }

        _updateAnimatedShapes(delta) {
            if (this.activeShape === 'wave') {
                this.wavePhase += delta * 0.4; // even slower wave animation
                this.shapes.wave = this._generateWavePositions(this.wavePhase);
                this.targetPositions = this.shapes.wave;
            }
        }

        _bindResize() {
            this._boundResize = () => this._handleResize();
            window.addEventListener('resize', this._boundResize);

            if ('ResizeObserver' in window) {
                this.resizeObserver = new ResizeObserver(() => this._handleResize());
                this.resizeObserver.observe(this.container);
            }
        }

        _handleResize() {
            if (!this.renderer) {
                return;
            }
            this._setRendererSize();
            this.camera.aspect = this._containerAspect();
            this.camera.updateProjectionMatrix();
        }

        _setRendererSize() {
            const width = this.container.clientWidth || window.innerWidth;
            const height = this.container.clientHeight || window.innerHeight;
            this.renderer.setSize(width, height);
        }

        _containerAspect() {
            const width = this.container.clientWidth || window.innerWidth;
            const height = this.container.clientHeight || window.innerHeight;
            return width / height;
        }
    }

    window.MorphingDots = MorphingDots;
})();
