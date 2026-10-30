/**
 * static/orb.js
 * Sleek Glossy Volumetric Frosted-Glass Voice Orb for Piston-VOICE-RAG
 * - Pure mathematical 3D sphere in WebGL (zero polygon/blob silhouette distortion)
 * - Low-frequency domain-warped internal silk ribbons (Soft Gold, Warm Amber, Peach, Obsidian Umber)
 * - Gossamer outer silk wisps on the upper-right and lower-left arcs
 * - Crisp optical champagne Fresnel rim light + studio softbox specular dome reflection
 * - High-DPI 2D canvas micro-dust particle halo
 */

function lerp(a, b, t) {
  return a + (b - a) * t;
}

const VERTEX_SHADER_SRC = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER_SRC = `
  precision highp float;
  varying vec2 v_uv;

  uniform vec2 u_resolution;
  uniform float u_radius;
  uniform float u_time;
  uniform float u_audio;
  uniform float u_state_thinking;
  uniform float u_state_speaking;
  uniform float u_state_listening;
  uniform float u_state_idle;
  uniform float u_shockwave;
  uniform vec2 u_pointer;

  // 3D Simplex Noise (Ashima Arts)
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    // Pure isotropic center-relative physical pixel coordinates: r = 1.0 is exactly the sphere radius
    vec2 center = u_resolution * 0.5;
    vec2 pixelOffset = gl_FragCoord.xy - center;
    pixelOffset.y = -pixelOffset.y; // Match screen top-down coordinate orientation
    vec2 p = pixelOffset / max(1.0, u_radius);
    float r = length(p);
    float angle = atan(p.y, p.x);

    // 1. Juicy Orange Fruit Palette (Active Listening mode - vibrant citrus fruit glow)
    vec3 listenObsidian   = vec3(0.24, 0.06, 0.01);  // Deep terracotta citrus shadow
    vec3 listenWarmAmber  = vec3(0.98, 0.44, 0.08);  // Fresh juicy citrus fruit orange (#F97316)
    vec3 listenSoftPeach  = vec3(1.00, 0.58, 0.16);  // Radiant ripe mandarin orange (#FB923C)
    vec3 listenSoftGold   = vec3(1.00, 0.74, 0.28);  // Luminous warm amber highlight (#FBBF24)
    vec3 listenChampagne  = vec3(1.00, 0.93, 0.80);  // Crisp warm citrus rim

    // 2. Solar Gold / Warm Apricot Palette (Active Speaking mode - bright audio flares)
    vec3 speakObsidian   = vec3(0.16, 0.07, 0.03);  // Deep smoky sienna
    vec3 speakWarmAmber  = vec3(0.94, 0.52, 0.20);  // Warm amber
    vec3 speakSoftPeach  = vec3(0.98, 0.68, 0.46);  // Soft apricot
    vec3 speakSoftGold   = vec3(1.00, 0.86, 0.48);  // Luminous gold
    vec3 speakChampagne  = vec3(1.00, 0.96, 0.86);  // Crisp champagne rim

    // 3. Serene Opal / Warm Pearl Palette (Idle standby breathing)
    vec3 idleObsidian   = vec3(0.13, 0.07, 0.04);
    vec3 idleWarmAmber  = vec3(0.88, 0.52, 0.25);
    vec3 idleSoftPeach  = vec3(0.94, 0.72, 0.56);
    vec3 idleSoftGold   = vec3(0.96, 0.84, 0.62);
    vec3 idleChampagne  = vec3(0.99, 0.96, 0.90);

    // 4. Cosmic Purple / Electric Violet Palette (Searching knowledge base / RAG / Thinking)
    vec3 purpleObsidian  = vec3(0.12, 0.03, 0.22); // Deep midnight plum depth
    vec3 purpleWarmAmber = vec3(0.58, 0.20, 0.92); // Vivid royal violet
    vec3 purpleSoftPeach = vec3(0.84, 0.32, 0.88); // Electric fuchsia / orchid
    vec3 purpleSoftGold  = vec3(0.76, 0.56, 0.98); // Radiant lavender-lilac
    vec3 purpleChampagne = vec3(0.97, 0.93, 1.00); // Shimmering crystal rim

    // Active color: blends between fruit orange (listening) and solar gold (speaking)
    vec3 activeObsidian   = mix(listenObsidian, speakObsidian, u_state_speaking);
    vec3 activeWarmAmber  = mix(listenWarmAmber, speakWarmAmber, u_state_speaking);
    vec3 activeSoftPeach  = mix(listenSoftPeach, speakSoftPeach, u_state_speaking);
    vec3 activeSoftGold   = mix(listenSoftGold, speakSoftGold, u_state_speaking);
    vec3 activeChampagne  = mix(listenChampagne, speakChampagne, u_state_speaking);

    // Smooth state-driven color palette morphing
    vec3 colObsidian  = mix(mix(activeObsidian, idleObsidian, u_state_idle), purpleObsidian, u_state_thinking);
    vec3 colWarmAmber = mix(mix(activeWarmAmber, idleWarmAmber, u_state_idle), purpleWarmAmber, u_state_thinking);
    vec3 colSoftPeach = mix(mix(activeSoftPeach, idleSoftPeach, u_state_idle), purpleSoftPeach, u_state_thinking);
    vec3 colSoftGold  = mix(mix(activeSoftGold, idleSoftGold, u_state_idle), purpleSoftGold, u_state_thinking);
    vec3 colChampagne = mix(mix(activeChampagne, idleChampagne, u_state_idle), purpleChampagne, u_state_thinking);

    // Delicate, translucent outer silk wisps (just outside r = 1.0, like the reference left/right arcs)
    float wispWave1 = snoise(vec3(cos(angle) * 1.3, sin(angle) * 1.3, u_time * 0.28));
    float wispWave2 = snoise(vec3(cos(angle * 2.0 - 0.5) * 1.5, sin(angle * 2.0 - 0.5) * 1.5, -u_time * 0.35));

    // Emphasize upper-right and lower-left silk membrane wisps
    float diagonalMask = pow(max(0.0, cos(angle - 0.35)), 2.0) * 0.85 +
                         pow(max(0.0, cos(angle - 3.35)), 2.0) * 0.95;

    float wispExtent = 1.0 + (0.042 + u_audio * 0.028 + u_shockwave * 0.035) * diagonalMask * smoothstep(-0.2, 0.8, wispWave1);
    float wispExtent2 = 1.0 + (0.028 + u_audio * 0.02) * smoothstep(-0.1, 0.85, wispWave2);

    // OUTSIDE THE SPHERE (r > 1.0): Render smooth atmospheric halo + gossamer silk veil
    if (r > 1.0) {
      if (r >= 1.25) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
      }
      float distOut = r - 1.0;
      float edgeFade = smoothstep(0.25, 0.0, distOut);

      // Base radial optical bloom around the crisp rim
      float halo = (exp(-distOut * 12.0) * 0.45 + exp(-distOut * 4.5) * 0.12) * edgeFade;
      halo *= (1.0 + u_audio * 0.35 + u_state_speaking * 0.15 + u_state_thinking * 0.25);

      // Gossamer silk veil Layer 1
      float veil1 = 0.0;
      if (r < wispExtent && wispExtent > 1.002) {
        float normWisp = (r - 1.0) / (wispExtent - 1.0);
        veil1 = (1.0 - normWisp * 0.65) * smoothstep(1.0, 0.72, normWisp) * 0.24 * diagonalMask;
        veil1 += exp(-pow((normWisp - 0.88) * 9.0, 2.0)) * 0.16 * diagonalMask;
      }

      // Gossamer silk veil Layer 2
      float veil2 = 0.0;
      if (r < wispExtent2 && wispExtent2 > 1.002) {
        float normWisp2 = (r - 1.0) / (wispExtent2 - 1.0);
        veil2 = (1.0 - normWisp2 * 0.7) * smoothstep(1.0, 0.68, normWisp2) * 0.15;
      }

      float totalOuterAlpha = clamp((halo + veil1 + veil2) * edgeFade, 0.0, 1.0);
      vec3 outerColor = mix(colWarmAmber, colChampagne, clamp(exp(-distOut * 16.0) + (veil1 + veil2) * 1.4, 0.0, 1.0));
      gl_FragColor = vec4(outerColor * totalOuterAlpha, totalOuterAlpha);
      return;
    }

    // INSIDE THE SPHERE (r <= 1.0): Pure, undistorted 3D sphere geometry
    float z = sqrt(max(0.0, 1.0 - r * r));
    vec3 normal = normalize(vec3(p.x, p.y, z));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);

    // Smooth pointer parallax tilt on the internal volume
    vec2 tiltedXY = normal.xy - u_pointer * 0.12 * z;

    // Gentle vortex rotation during 'thinking' state
    float swirl = u_state_thinking * (1.0 - z * 0.6) * 1.35;
    mat2 rot = mat2(cos(swirl), -sin(swirl), sin(swirl), cos(swirl));
    tiltedXY = rot * tiltedXY;

    // Low-frequency, ultra-smooth internal silk folds
    float t = u_time * 0.24;
    vec3 samplePos = vec3(tiltedXY * 0.92, z * 0.85);

    vec3 warp = vec3(
      snoise(samplePos * 0.85 + vec3(0.0, t * 0.7, t * 0.4)),
      snoise(samplePos * 0.85 + vec3(3.4, -t * 0.6, t * 0.3)),
      snoise(samplePos * 0.85 + vec3(-2.1, t * 0.5, -t * 0.5))
    );

    float foldPrimary = snoise(samplePos * 1.05 + warp * 0.65 + vec3(t * 0.2, -t * 0.15, 0.0));
    float foldSecondary = snoise(samplePos * 1.45 - warp * 0.45 + vec3(-t * 0.25, t * 0.2, t * 0.3));

    float ribbonA = smoothstep(-0.65, 0.70, foldPrimary);
    float ribbonB = smoothstep(-0.60, 0.65, foldSecondary);

    // 1. Base amber/peach/violet body
    vec3 interior = mix(colWarmAmber, colSoftPeach, ribbonB * 0.75);

    // 2. Luminous soft-gold/lavender curves sweeping across the right/upper-right & lower-left
    float goldMask = smoothstep(0.32, 0.88, ribbonA * 0.75 + (normal.x * 0.25 + normal.y * 0.15));
    interior = mix(interior, colSoftGold, goldMask * (0.82 + u_audio * 0.25 + u_state_speaking * 0.2));

    // 3. Deep smoky umber/plum depth pocket in the upper-left/center-top & lower-right interior
    float depthPocket1 = smoothstep(0.78, 0.0, length(tiltedXY - vec2(-0.14, 0.36)));
    float depthPocket2 = smoothstep(0.75, 0.0, length(tiltedXY - vec2(0.28, -0.32)));
    float shadowFactor = clamp(depthPocket1 * (0.72 - ribbonA * 0.35) + depthPocket2 * (0.45 - ribbonB * 0.25), 0.0, 0.78);
    interior = mix(interior, colObsidian, shadowFactor);

    // 4. Inner curved caustic fold highlight
    float ridge = 1.0 - abs(foldPrimary - foldSecondary * 0.55);
    ridge = pow(clamp(ridge, 0.0, 1.0), 4.5);
    interior += mix(colWarmAmber, colSoftGold, 0.6) * ridge * 0.22 * z;

    // 5. Audio / Speaking volumetric core radiance
    float corePulse = (u_audio * 0.35 + u_state_speaking * 0.18 + u_shockwave * 0.35) * pow(z, 0.8);
    interior += colSoftGold * corePulse * 0.42;

    // 6. Sleek Glossy Glass Specular Reflections
    vec3 lightKey = normalize(vec3(-0.35, 0.48, 0.80));
    vec3 lightFill = normalize(vec3(0.42, -0.45, 0.78));
    vec3 halfVecKey = normalize(lightKey + viewDir);
    vec3 halfVecFill = normalize(lightFill + viewDir);

    float specGlossKey = pow(max(0.0, dot(normal, halfVecKey)), 28.0);
    float specBroadKey = pow(max(0.0, dot(normal, halfVecKey)), 5.5);
    float specFill = pow(max(0.0, dot(normal, halfVecFill)), 14.0);

    interior += colChampagne * specGlossKey * 0.20;
    interior += colSoftGold * specBroadKey * 0.10;
    interior += colSoftPeach * specFill * 0.12;

    // 7. Optical Frosted-Glass Fresnel Rim Light
    float ndotv = max(0.0, dot(normal, viewDir));
    float fresnelSoft  = pow(1.0 - ndotv, 2.4);
    float fresnelMid   = pow(1.0 - ndotv, 5.5);
    float fresnelCrisp = pow(1.0 - ndotv, 14.0);

    float rimLightMod = 0.84 + 0.16 * cos(angle - 0.6);
    float rimBoost = 1.0 + u_audio * 0.22 + u_shockwave * 0.4;

    vec3 rimLight =
      colSoftGold * fresnelSoft * 0.34 * rimBoost +
      colChampagne * fresnelMid * 0.62 * rimLightMod * rimBoost +
      vec3(1.0, 0.99, 0.95) * fresnelCrisp * 0.65 * rimBoost;

    vec3 finalRGB = interior + rimLight;

    float sphereCoverage = smoothstep(1.0, 0.992, r);
    float edgeHalo = exp(-(1.0 - r) * 10.0) * 0.48;
    float sphereAlpha = max(sphereCoverage, edgeHalo);

    gl_FragColor = vec4(finalRGB * sphereAlpha, sphereAlpha);
  }
`;

class VoiceOrbVisualizer {
  constructor(canvasOrSelector) {
    if (typeof canvasOrSelector === 'string') {
      this.canvas = document.querySelector(canvasOrSelector) || document.getElementById(canvasOrSelector);
    } else if (canvasOrSelector instanceof HTMLCanvasElement) {
      this.canvas = canvasOrSelector;
    } else if (canvasOrSelector instanceof HTMLElement) {
      // If a wrapper div was passed, find or create a canvas inside it
      this.canvas = canvasOrSelector.querySelector('canvas');
      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'orb-canvas';
        canvasOrSelector.appendChild(this.canvas);
      }
    } else {
      this.canvas = document.querySelector('#orb-canvas, canvas.orb, #orb, canvas');
    }

    if (!this.canvas) {
      console.error('VoiceOrbVisualizer: No canvas element found.');
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.ensureAmbientBloomDOM();

    this.glCanvas = document.createElement('canvas');
    this.gl =
      this.glCanvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true }) ||
      this.glCanvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });

    this.state = 'idle';
    this.isRunning = true;

    this.time = 0;
    this.fluidTime = 0;
    this.currentScale = 1.0;
    this.targetScale = 0.99;
    this.currentSpeed = 0.0035;
    this.targetSpeed = 0.0035;

    this.audioLevel = 0.0;
    this.smoothedAudio = 0.0;

    this.thinkingWeight = 0.0;
    this.speakingWeight = 0.0;
    this.listeningWeight = 0.0;
    this.idleWeight = 1.0;
    this.shockwave = 0.0;

    this.pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

    this.initWebGL();
    this.initParticles(95);
    this.resize();
    this.bindEvents();

    this._lastTime = performance.now();
    this._rafId = requestAnimationFrame((now) => this._loop(now));
  }

  ensureAmbientBloomDOM() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    parent.classList.add('orb-stage-wrapper');

    if (!document.getElementById('orb-deep-bloom')) {
      const deep = document.createElement('div');
      deep.id = 'orb-deep-bloom';
      deep.setAttribute('aria-hidden', 'true');
      parent.insertBefore(deep, this.canvas);
    }
    if (!document.getElementById('orb-ambient-bloom')) {
      const ambient = document.createElement('div');
      ambient.id = 'orb-ambient-bloom';
      ambient.setAttribute('aria-hidden', 'true');
      parent.insertBefore(ambient, this.canvas);
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    if (typeof ResizeObserver !== 'undefined' && this.canvas.parentElement) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas.parentElement);
    }

    const targetEl = this.canvas.parentElement || this.canvas;
    targetEl.addEventListener('pointermove', (e) => {
      const rect = targetEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      this.pointer.targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.targetY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    });

    targetEl.addEventListener('pointerleave', () => {
      this.pointer.targetX = 0;
      this.pointer.targetY = 0;
    });

    targetEl.addEventListener('pointerdown', () => {
      this.triggerInterruptRipple();
    });
  }

  initWebGL() {
    const gl = this.gl;
    if (!gl) return;

    const compile = (type, src) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Orb Shader compile error:', gl.getShaderInfoLog(shader));
      }
      return shader;
    };

    const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);

    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    gl.useProgram(this.program);

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    this.uniforms = {
      u_resolution: gl.getUniformLocation(this.program, 'u_resolution'),
      u_radius: gl.getUniformLocation(this.program, 'u_radius'),
      u_time: gl.getUniformLocation(this.program, 'u_time'),
      u_audio: gl.getUniformLocation(this.program, 'u_audio'),
      u_state_thinking: gl.getUniformLocation(this.program, 'u_state_thinking'),
      u_state_speaking: gl.getUniformLocation(this.program, 'u_state_speaking'),
      u_state_listening: gl.getUniformLocation(this.program, 'u_state_listening'),
      u_state_idle: gl.getUniformLocation(this.program, 'u_state_idle'),
      u_shockwave: gl.getUniformLocation(this.program, 'u_shockwave'),
      u_pointer: gl.getUniformLocation(this.program, 'u_pointer'),
    };
  }

  initParticles(count) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distFactor = 1.012 + Math.pow(Math.random(), 1.7) * 0.22;
      this.particles.push({
        angle,
        baseDist: distFactor,
        size: 0.4 + Math.random() * 0.95,
        angularSpeed: (Math.random() - 0.5) * 0.0022,
        radialPhase: Math.random() * Math.PI * 2,
        radialSpeed: 0.006 + Math.random() * 0.012,
        alpha: 0.2 + Math.random() * 0.65,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.015 + Math.random() * 0.03,
        color: Math.random() > 0.3 ? '#FFE8B3' : '#FFAD87',
      });
    }
  }

  resize() {
    if (!this.canvas) return;
    const parentRect = this.canvas.parentElement
      ? this.canvas.parentElement.getBoundingClientRect()
      : this.canvas.getBoundingClientRect();

    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    const fallbackSize = 420;
    this.width = Math.max(1, parentRect.width || this.canvas.clientWidth || fallbackSize);
    this.height = Math.max(1, parentRect.height || this.canvas.clientHeight || fallbackSize);

    const pixelW = Math.max(1, Math.round(this.width * this.dpr));
    const pixelH = Math.max(1, Math.round(this.height * this.dpr));

    this.canvas.width = pixelW;
    this.canvas.height = pixelH;

    this.glCanvas.width = pixelW;
    this.glCanvas.height = pixelH;

    if (this.gl) {
      this.gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
    }

    this.baseRadius = Math.min(this.width, this.height) * 0.345;
  }

  /**
   * State transitions ('idle' | 'listening' | 'thinking' | 'speaking' | 'processing' | 'muted')
   */
  setState(newState) {
    const norm = String(newState || 'idle').toLowerCase();
    if (norm === 'processing' || norm === 'searching' || norm === 'rag' || norm === 'loading') {
      this.state = 'thinking';
    } else if (norm === 'talking' || norm === 'assistant' || norm === 'responding') {
      this.state = 'speaking';
    } else if (norm === 'active' || norm === 'recording' || norm === 'user') {
      this.state = 'listening';
    } else {
      this.state = norm;
    }

    switch (this.state) {
      case 'idle':
        this.targetSpeed = 0.0035;
        this.targetScale = 0.99;
        break;
      case 'listening':
        this.targetSpeed = 0.0065;
        this.targetScale = 1.02;
        break;
      case 'thinking':
        this.targetSpeed = 0.014;
        this.targetScale = 1.01;
        break;
      case 'speaking':
        this.targetSpeed = 0.010;
        this.targetScale = 1.04;
        break;
      default:
        this.targetSpeed = 0.0045;
        this.targetScale = 1.0;
        break;
    }
  }

  // Compatibility aliases for any existing app.js calls
  setMode(mode) {
    this.setState(mode);
  }

  setAudioLevel(rms) {
    if (typeof rms === 'number' && !isNaN(rms)) {
      this.audioLevel = Math.max(0, Math.min(1, rms));
    }
  }

  setVolume(val) {
    this.setAudioLevel(val);
  }

  setLevel(val) {
    this.setAudioLevel(val);
  }

  updateAudio(dataOrRms) {
    if (typeof dataOrRms === 'number') {
      this.setAudioLevel(dataOrRms);
    } else if (dataOrRms && dataOrRms.length) {
      let sum = 0;
      for (let i = 0; i < dataOrRms.length; i++) {
        const v = dataOrRms[i];
        sum += Math.abs(v > 1 ? (v - 128) / 128 : v);
      }
      this.setAudioLevel(Math.min(1, (sum / dataOrRms.length) * 2.5));
    }
  }

  triggerInterruptRipple() {
    this.shockwave = 1.0;
    this.smoothedAudio = Math.max(this.smoothedAudio, 0.45);
  }

  pulse() {
    this.triggerInterruptRipple();
  }

  interrupt() {
    this.triggerInterruptRipple();
  }

  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this._lastTime = performance.now();
      this._rafId = requestAnimationFrame((now) => this._loop(now));
    }
  }

  stop() {
    this.isRunning = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  drawMicroDustHalo(ctx, cx, cy, radius) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const orbitBoost = 1.0 + this.thinkingWeight * 3.2 + this.smoothedAudio * 1.2;
    const isSearching = this.thinkingWeight > 0.05;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      p.angle += p.angularSpeed * orbitBoost;
      p.radialPhase += p.radialSpeed;
      p.twinklePhase += p.twinkleSpeed;

      const radialDrift = Math.sin(p.radialPhase) * 0.022;
      const currentDistFactor =
        p.baseDist + radialDrift + this.smoothedAudio * 0.025 + this.shockwave * 0.04;

      const dist = radius * currentDistFactor;
      const x = cx + Math.cos(p.angle) * dist;
      const y = cy + Math.sin(p.angle) * dist;

      const normOut = Math.max(0, (currentDistFactor - 1.0) / 0.25);
      const distFade = Math.sin(Math.min(1, normOut) * Math.PI);
      const twinkle = 0.5 + 0.5 * Math.sin(p.twinklePhase);
      const alpha = p.alpha * distFade * twinkle * (0.75 + this.smoothedAudio * 0.4);

      if (alpha <= 0.02) continue;

      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = isSearching ? (i % 2 === 0 ? '#C084FC' : '#E9D5FF') : p.color;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fill();
    }

    ctx.restore();
  }

  render(dt) {
    if (!this.canvas || !this.glCanvas.width || !this.glCanvas.height) {
      this.resize();
      if (!this.glCanvas.width || !this.glCanvas.height) return;
    }

    this.time += dt;

    const audioLerp = this.audioLevel > this.smoothedAudio ? 0.14 : 0.06;
    this.smoothedAudio = lerp(this.smoothedAudio, this.audioLevel, audioLerp);
    this.currentSpeed = lerp(this.currentSpeed, this.targetSpeed, 0.04);
    this.fluidTime += this.currentSpeed * (1.0 + this.smoothedAudio * 0.9);

    this.thinkingWeight = lerp(this.thinkingWeight, this.state === 'thinking' ? 1.0 : 0.0, 0.04);
    this.speakingWeight = lerp(this.speakingWeight, this.state === 'speaking' ? 1.0 : 0.0, 0.07);
    this.listeningWeight = lerp(this.listeningWeight, this.state === 'listening' ? 1.0 : 0.0, 0.06);
    this.idleWeight = lerp(this.idleWeight, this.state === 'idle' ? 1.0 : 0.0, 0.05);
    this.shockwave = lerp(this.shockwave, 0.0, 0.06);

    this.pointer.x = lerp(this.pointer.x, this.pointer.targetX, 0.07);
    this.pointer.y = lerp(this.pointer.y, this.pointer.targetY, 0.07);

    const breatheOsc = Math.sin(this.time * 1.4) * 0.014;
    const speechBoost = this.smoothedAudio * (this.state === 'speaking' ? 0.085 : 0.045);
    const desiredScale = this.targetScale + breatheOsc + speechBoost;
    this.currentScale = lerp(this.currentScale, desiredScale, 0.09);

    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const currentRadius = this.baseRadius * this.currentScale;

    const gl = this.gl;
    if (gl && this.program) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform2f(this.uniforms.u_resolution, this.glCanvas.width, this.glCanvas.height);
      gl.uniform1f(this.uniforms.u_radius, currentRadius * this.dpr);
      gl.uniform1f(this.uniforms.u_time, this.fluidTime * 3.0);
      gl.uniform1f(this.uniforms.u_audio, this.smoothedAudio);
      gl.uniform1f(this.uniforms.u_state_thinking, this.thinkingWeight);
      gl.uniform1f(this.uniforms.u_state_speaking, this.speakingWeight);
      gl.uniform1f(this.uniforms.u_state_listening, this.listeningWeight);
      gl.uniform1f(this.uniforms.u_state_idle, this.idleWeight);
      gl.uniform1f(this.uniforms.u_shockwave, this.shockwave);
      gl.uniform2f(this.uniforms.u_pointer, this.pointer.x, this.pointer.y);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    if (this.glCanvas.width > 0 && this.glCanvas.height > 0) {
      ctx.drawImage(this.glCanvas, 0, 0, this.width, this.height);
    }

    this.drawMicroDustHalo(ctx, cx, cy, currentRadius);
    ctx.restore();

    const isDark = document.body && document.body.classList.contains('dark-mode');
    const bloomScale = this.currentScale + this.smoothedAudio * 0.16;
    const ambientBloomEl = document.getElementById('orb-ambient-bloom');
    const deepBloomEl = document.getElementById('orb-deep-bloom');
    if (ambientBloomEl && deepBloomEl) {
      ambientBloomEl.style.transform = `translate(-50%, -50%) scale(${bloomScale.toFixed(3)})`;
      deepBloomEl.style.transform = `translate(-50%, -50%) scale(${(1.0 + this.smoothedAudio * 0.12).toFixed(3)})`;

      const baseAmbientOpacity = (isDark ? 0.75 : 0.45) + this.smoothedAudio * 0.35;
      ambientBloomEl.style.opacity = baseAmbientOpacity.toFixed(2);
      deepBloomEl.style.opacity = (isDark ? 0.90 : 0.55).toFixed(2);

      // Adaptive color gradient: Cosmic Purple (Searching) vs Fruit Orange (Listening) vs Solar Amber (Idle/Speaking)
      if (this.thinkingWeight > 0.05) {
        ambientBloomEl.style.background = isDark
          ? 'radial-gradient(circle, rgba(192, 132, 252, 0.24) 0%, rgba(147, 51, 234, 0.14) 44%, rgba(147, 51, 234, 0) 72%)'
          : 'radial-gradient(circle, rgba(192, 132, 252, 0.15) 0%, rgba(147, 51, 234, 0.08) 44%, rgba(147, 51, 234, 0) 72%)';
        deepBloomEl.style.background = isDark
          ? 'radial-gradient(circle, rgba(126, 34, 206, 0.14) 0%, rgba(168, 85, 247, 0.05) 48%, rgba(126, 34, 206, 0) 74%)'
          : 'radial-gradient(circle, rgba(126, 34, 206, 0.07) 0%, rgba(168, 85, 247, 0.03) 48%, rgba(126, 34, 206, 0) 74%)';
      } else if (this.listeningWeight > 0.1) {
        ambientBloomEl.style.background = isDark
          ? 'radial-gradient(circle, rgba(249, 115, 22, 0.24) 0%, rgba(234, 88, 12, 0.14) 44%, rgba(234, 88, 12, 0) 72%)'
          : 'radial-gradient(circle, rgba(249, 115, 22, 0.16) 0%, rgba(234, 88, 12, 0.09) 44%, rgba(234, 88, 12, 0) 72%)';
        deepBloomEl.style.background = isDark
          ? 'radial-gradient(circle, rgba(234, 88, 12, 0.13) 0%, rgba(251, 146, 60, 0.05) 48%, rgba(234, 88, 12, 0) 74%)'
          : 'radial-gradient(circle, rgba(234, 88, 12, 0.08) 0%, rgba(251, 146, 60, 0.03) 48%, rgba(234, 88, 12, 0) 74%)';
      } else {
        ambientBloomEl.style.background = isDark
          ? 'radial-gradient(circle, rgba(255, 209, 102, 0.19) 0%, rgba(245, 130, 49, 0.12) 44%, rgba(245, 130, 49, 0) 72%)'
          : 'radial-gradient(circle, rgba(255, 209, 102, 0.14) 0%, rgba(245, 130, 49, 0.08) 44%, rgba(245, 130, 49, 0) 72%)';
        deepBloomEl.style.background = isDark
          ? 'radial-gradient(circle, rgba(245, 130, 49, 0.11) 0%, rgba(255, 173, 135, 0.04) 48%, rgba(245, 130, 49, 0) 74%)'
          : 'radial-gradient(circle, rgba(245, 130, 49, 0.07) 0%, rgba(255, 173, 135, 0.02) 48%, rgba(245, 130, 49, 0) 74%)';
      }
    }
  }

  _loop(now) {
    if (!this.isRunning) return;
    const dt = Math.min(0.05, (now - this._lastTime) / 1000);
    this._lastTime = now;
    this.render(dt);
    this._rafId = requestAnimationFrame((t) => this._loop(t));
  }
}

// Export under all common names so static/app.js works out of the box
window.VoiceOrbVisualizer = VoiceOrbVisualizer;
window.OrbVisualizer = VoiceOrbVisualizer;
window.PistonOrb = VoiceOrbVisualizer;
window.Orb = VoiceOrbVisualizer;
