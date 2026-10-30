/**
 * Piston Voice RAG — Sleek Glossy Volumetric Orb Engine
 *
 * WebGL Shader for a Crisp, Perfectly Spherical Frosted-Glass Orb:
 *  - Zero polygon/blob distortion on the silhouette (pure mathematical sphere)
 *  - Silky, low-frequency internal subsurface ribbon folds
 *  - Delicate gossamer lateral aura wisps rendered smoothly in shader outside r=1.0
 *  - Crisp optical Fresnel rim light + glossy glass dome specular reflections
 *  - High-DPI micro-dust particle halo on compositing 2D canvas
 *  - Full audio reactivity and state machine (idle, listening, thinking, speaking)
 */

(function (window) {
  'use strict';

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

    uniform float u_time;
    uniform float u_audio;
    uniform float u_state_thinking;
    uniform float u_state_speaking;
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
      // Coordinate space [-1.42, 1.42] so the sphere sits cleanly inside with room for the outer silk veil
      vec2 p = (v_uv - 0.5) * 2.84;
      float r = length(p);
      float angle = atan(p.y, p.x);

      // Reference Palette
      vec3 colObsidian   = vec3(0.16, 0.07, 0.03);  // Deep smoky umber/sienna depth
      vec3 colWarmAmber  = vec3(0.94, 0.50, 0.20);  // Rich warm orange-amber
      vec3 colSoftPeach  = vec3(0.98, 0.68, 0.48);  // Creamy peach-apricot
      vec3 colSoftGold   = vec3(1.00, 0.85, 0.48);  // Luminous warm gold
      vec3 colChampagne  = vec3(1.00, 0.96, 0.86);  // Crisp champagne rim highlight

      // Delicate, translucent outer silk wisps (just outside r = 1.0, like the reference left/right arcs)
      float wispWave1 = snoise(vec3(cos(angle) * 1.3, sin(angle) * 1.3, u_time * 0.28));
      float wispWave2 = snoise(vec3(cos(angle * 2.0 - 0.5) * 1.5, sin(angle * 2.0 - 0.5) * 1.5, -u_time * 0.35));

      // Emphasize upper-right and lower-left silk membrane wisps as seen in the target image
      float diagonalMask = pow(max(0.0, cos(angle - 0.35)), 2.0) * 0.85 +
                           pow(max(0.0, cos(angle - 3.35)), 2.0) * 0.95;

      float wispExtent = 1.0 + (0.042 + u_audio * 0.028 + u_shockwave * 0.035) * diagonalMask * smoothstep(-0.2, 0.8, wispWave1);
      float wispExtent2 = 1.0 + (0.028 + u_audio * 0.02) * smoothstep(-0.1, 0.85, wispWave2);

      // OUTSIDE THE SPHERE (r > 1.0): Render smooth atmospheric halo + gossamer silk veil
      if (r > 1.0) {
        float distOut = r - 1.0;

        // Base radial optical bloom around the crisp rim
        float halo = exp(-distOut * 10.5) * 0.46 + exp(-distOut * 3.6) * 0.14;
        halo *= (1.0 + u_audio * 0.35 + u_state_speaking * 0.15);

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

        float totalOuterAlpha = clamp(halo + veil1 + veil2, 0.0, 1.0);
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
      float swirl = u_state_thinking * (1.0 - z * 0.6) * 1.1;
      mat2 rot = mat2(cos(swirl), -sin(swirl), sin(swirl), cos(swirl));
      tiltedXY = rot * tiltedXY;

      // Low-frequency, ultra-smooth internal silk folds (no grainy turbulence!)
      float t = u_time * 0.24;
      vec3 samplePos = vec3(tiltedXY * 0.92, z * 0.85);

      // Smooth domain warp for big, creamy volumetric ribbons
      vec3 warp = vec3(
        snoise(samplePos * 0.85 + vec3(0.0, t * 0.7, t * 0.4)),
        snoise(samplePos * 0.85 + vec3(3.4, -t * 0.6, t * 0.3)),
        snoise(samplePos * 0.85 + vec3(-2.1, t * 0.5, -t * 0.5))
      );

      float foldPrimary = snoise(samplePos * 1.05 + warp * 0.65 + vec3(t * 0.2, -t * 0.15, 0.0));
      float foldSecondary = snoise(samplePos * 1.45 - warp * 0.45 + vec3(-t * 0.25, t * 0.2, t * 0.3));

      // Smooth S-curves for velvety color transitions
      float ribbonA = smoothstep(-0.65, 0.70, foldPrimary);
      float ribbonB = smoothstep(-0.60, 0.65, foldSecondary);

      // 1. Base warm amber-peach body
      vec3 interior = mix(colWarmAmber, colSoftPeach, ribbonB * 0.75);

      // 2. Luminous soft-gold curves sweeping across the right/upper-right & lower-left
      float goldMask = smoothstep(0.32, 0.88, ribbonA * 0.75 + (normal.x * 0.25 + normal.y * 0.15));
      interior = mix(interior, colSoftGold, goldMask * (0.82 + u_audio * 0.25 + u_state_speaking * 0.2));

      // 3. Deep smoky umber/sienna depth pocket in the upper-left & lower-right interior
      float depthPocket1 = smoothstep(0.78, 0.0, length(tiltedXY - vec2(-0.14, 0.36)));
      float depthPocket2 = smoothstep(0.75, 0.0, length(tiltedXY - vec2(0.28, -0.32)));
      float shadowFactor = clamp(depthPocket1 * (0.72 - ribbonA * 0.35) + depthPocket2 * (0.45 - ribbonB * 0.25), 0.0, 0.78);
      interior = mix(interior, colObsidian, shadowFactor);

      // 4. Inner curved caustic fold highlight (the soft S-curve ridge inside the reference orb)
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

      // Sub-pixel anti-aliased transition at r = 1.0
      float sphereCoverage = smoothstep(1.0, 0.992, r);
      float edgeHalo = exp(-(1.0 - r) * 10.0) * 0.48;

      gl_FragColor = vec4(finalRGB, max(sphereCoverage, edgeHalo));
    }
  `;

  class VoiceOrbVisualizer {
    constructor(canvasEl, options = {}) {
      if (!canvasEl) {
        throw new Error('VoiceOrbVisualizer requires a valid HTML5 canvas element.');
      }

      this.canvas = canvasEl;
      this.ctx = this.canvas.getContext('2d');

      // Create offscreen WebGL canvas for shader rendering
      this.glCanvas = document.createElement('canvas');
      this.gl = this.glCanvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: false }) ||
                this.glCanvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });

      this.state = 'idle';

      this.time = 0;
      this.fluidTime = 0;
      this.currentScale = 1.0;
      this.targetScale = 1.0;
      this.currentSpeed = 0.005;
      this.targetSpeed = 0.005;

      this.audioLevel = 0.0;
      this.smoothedAudio = 0.0;

      this.thinkingWeight = 0.0;
      this.speakingWeight = 0.0;
      this.shockwave = 0.0;

      this.pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
      this.lastTimestamp = performance.now();

      this.initWebGL();
      this.initParticles(85);
      this.resize();
      this.initEvents();

      // Self-driving 60FPS animation loop
      this.rafId = requestAnimationFrame(this._loop.bind(this));
    }

    initWebGL() {
      const gl = this.gl;
      if (!gl) {
        console.warn('WebGL not available for VoiceOrbVisualizer, fallback active.');
        return;
      }

      const compile = (type, src) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        }
        return shader;
      };

      const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
      const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);

      this.program = gl.createProgram();
      gl.attachShader(this.program, vs);
      gl.attachShader(this.program, fs);
      gl.linkProgram(this.program);

      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        console.error('Shader program link error:', gl.getProgramInfoLog(this.program));
        return;
      }

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
        u_time: gl.getUniformLocation(this.program, 'u_time'),
        u_audio: gl.getUniformLocation(this.program, 'u_audio'),
        u_state_thinking: gl.getUniformLocation(this.program, 'u_state_thinking'),
        u_state_speaking: gl.getUniformLocation(this.program, 'u_state_speaking'),
        u_shockwave: gl.getUniformLocation(this.program, 'u_shockwave'),
        u_pointer: gl.getUniformLocation(this.program, 'u_pointer'),
      };
    }

    initParticles(count) {
      this.particles = [];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        // Fine micro-dust concentrated closely around the rim (1.012x to 1.23x)
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
          color: Math.random() > 0.3 ? '#FFE8B3' : '#FFAD87'
        });
      }
    }

    initEvents() {
      this._onResize = () => this.resize();
      window.addEventListener('resize', this._onResize);

      const parent = this.canvas.parentElement;
      if (parent) {
        parent.addEventListener('pointermove', (e) => {
          const rect = parent.getBoundingClientRect();
          this.pointer.targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          this.pointer.targetY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        });

        parent.addEventListener('pointerleave', () => {
          this.pointer.targetX = 0;
          this.pointer.targetY = 0;
        });

        parent.addEventListener('pointerdown', () => {
          this.triggerInterruptRipple();
        });
      }

      if (typeof ResizeObserver !== 'undefined' && parent) {
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(parent);
      }
    }

    resize() {
      const parent = this.canvas.parentElement;
      const rect = parent ? parent.getBoundingClientRect() : { width: 420, height: 420 };
      this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);

      const fallbackSize = Math.min(window.innerWidth || 420, window.innerHeight || 420, 560);
      this.width = Math.max(1, rect.width || fallbackSize);
      this.height = Math.max(1, rect.height || fallbackSize);

      const pixelW = Math.max(1, Math.round(this.width * this.dpr));
      const pixelH = Math.max(1, Math.round(this.height * this.dpr));

      this.canvas.width = pixelW;
      this.canvas.height = pixelH;

      this.glCanvas.width = pixelW;
      this.glCanvas.height = pixelH;

      if (this.gl) {
        this.gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
      }

      this.baseRadius = Math.min(this.width, this.height) * 0.30;
    }

    setState(newState) {
      if (newState === 'searching') newState = 'thinking';
      this.state = newState;
      switch (newState) {
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
        case 'error':
          this.targetSpeed = 0.003;
          this.targetScale = 0.98;
          break;
      }
    }

    setAudioLevel(rms) {
      this.audioLevel = Math.max(0, Math.min(1, rms || 0));
    }

    triggerInterruptRipple() {
      this.shockwave = 1.0;
      this.smoothedAudio = 0.45;
    }

    drawMicroDustHalo(ctx, cx, cy, radius) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      const orbitBoost = 1.0 + this.thinkingWeight * 2.5 + this.smoothedAudio * 1.2;

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];

        p.angle += p.angularSpeed * orbitBoost;
        p.radialPhase += p.radialSpeed;
        p.twinklePhase += p.twinkleSpeed;

        const radialDrift = Math.sin(p.radialPhase) * 0.022;
        const currentDistFactor = p.baseDist + radialDrift + this.smoothedAudio * 0.025 + this.shockwave * 0.04;

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
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.fill();
      }

      ctx.restore();
    }

    _loop(timestamp) {
      const dt = Math.min(0.05, (timestamp - this.lastTimestamp) / 1000);
      this.lastTimestamp = timestamp;

      this.render(dt);
      this.rafId = requestAnimationFrame(this._loop.bind(this));
    }

    render(dt) {
      if (!this.glCanvas.width || !this.glCanvas.height || !this.canvas.width || !this.canvas.height) {
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
      this.shockwave = lerp(this.shockwave, 0.0, 0.06);

      this.pointer.x = lerp(this.pointer.x, this.pointer.targetX, 0.07);
      this.pointer.y = lerp(this.pointer.y, this.pointer.targetY, 0.07);

      // Subtle, poised breathing & speaking scale pulse
      const breatheOsc = Math.sin(this.time * 1.4) * 0.014;
      const speechBoost = this.smoothedAudio * (this.state === 'speaking' ? 0.085 : 0.045);
      const desiredScale = this.targetScale + breatheOsc + speechBoost;
      this.currentScale = lerp(this.currentScale, desiredScale, 0.09);

      // 1. Render WebGL Volumetric Sphere & Gossamer Silk Veil
      const gl = this.gl;
      if (gl && this.program) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.uniform1f(this.uniforms.u_time, this.fluidTime * 3.0);
        gl.uniform1f(this.uniforms.u_audio, this.smoothedAudio);
        gl.uniform1f(this.uniforms.u_state_thinking, this.thinkingWeight);
        gl.uniform1f(this.uniforms.u_state_speaking, this.speakingWeight);
        gl.uniform1f(this.uniforms.u_shockwave, this.shockwave);
        gl.uniform2f(this.uniforms.u_pointer, this.pointer.x, this.pointer.y);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      // 2. Composite onto High-DPI 2D Canvas
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);

      const cx = this.width * 0.5;
      const cy = this.height * 0.5;
      const currentRadius = this.baseRadius * this.currentScale;

      // Coordinate scale in fragment shader is [-1.42, 1.42] -> diameter = 2.84 * radius
      const quadSize = currentRadius * 2.84;
      if (this.glCanvas.width > 0 && this.glCanvas.height > 0 && quadSize > 0) {
        ctx.drawImage(
          this.glCanvas,
          cx - quadSize * 0.5,
          cy - quadSize * 0.5,
          quadSize,
          quadSize
        );
      }

      // Render fine micro-dust particles in the outer rim glow
      this.drawMicroDustHalo(ctx, cx, cy, currentRadius);

      ctx.restore();

      // 3. Sync Ambient Backdrop Glow
      const bloomScale = this.currentScale + this.smoothedAudio * 0.16;
      const ambientBloomEl = document.getElementById('orb-ambient-bloom');
      const deepBloomEl = document.getElementById('orb-deep-bloom');
      if (ambientBloomEl && deepBloomEl) {
        ambientBloomEl.style.transform = `translate(-50%, -50%) scale(${bloomScale.toFixed(3)})`;
        ambientBloomEl.style.opacity = (0.75 + this.smoothedAudio * 0.35).toFixed(2);
        deepBloomEl.style.transform = `translate(-50%, -50%) scale(${(1.0 + this.smoothedAudio * 0.12).toFixed(3)})`;
      }
    }

    destroy() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      if (this.resizeObserver) this.resizeObserver.disconnect();
      window.removeEventListener('resize', this._onResize);
    }
  }

  // Export both class names for seamless compatibility
  window.VoiceOrbVisualizer = VoiceOrbVisualizer;
  window.OrbVisualizer = VoiceOrbVisualizer;
})(window);
