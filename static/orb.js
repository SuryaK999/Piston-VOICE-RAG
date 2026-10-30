/**
 * Piston Voice RAG — Volumetric Frosted-Glass Voice Orb Visualizer
 *
 * Implements a hyper-clean, minimal, 3D volumetric frosted-glass orb visualizer
 * matching modern voice AI aesthetics (ChatGPT Advanced Voice / Siri / Gemini Live).
 *
 * Technical Specifications:
 *  - High-DPI Canvas 2D engine with sub-pixel crispness
 *  - Linear interpolation (lerp) for buttery-smooth state and audio reactivity
 *  - No harsh solid outlines: soft Fresnel rim light feathering inward (28px)
 *  - Internal volumetric fluid: 4 organic color blobs (Gold, Amber, Peach, Burnt Sienna)
 *  - Translucent outer membrane: 2 delicate undulating wave layers
 *  - Micro-particle halo: 80 micro-dust particles drifting at 1.02x to 1.25x radius
 *  - Atmospheric multi-layered ambient bloom (50px inner, 120px wide bleed)
 *  - 4 core states: idle, listening, thinking (searching), speaking
 */

(function (window) {
  'use strict';

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const lerp = (a, b, t) => a + (b - a) * t;

  class VoiceOrbVisualizer {
    constructor(canvas, options = {}) {
      if (!canvas) {
        throw new Error('VoiceOrbVisualizer requires a valid HTML5 canvas element.');
      }

      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true });
      this.options = Object.assign({
        particleCount: 80,
      }, options);

      this.width = 0;
      this.height = 0;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.centerX = 0;
      this.centerY = 0;
      this.baseRadius = 100;

      // State machine: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
      this.state = 'idle';
      this.targetState = 'idle';

      // Audio Reactivity with Linear Interpolation
      this.audioLevel = 0.0;
      this.targetAudioLevel = 0.0;
      this.smoothedAudio = 0.0;

      // Fluid Simulation Clocks & Speeds
      this.time = 0;
      this.fluidTime = 0;
      this.membraneTime = 0;
      this.vortexAngle = 0;
      this.lastTimestamp = performance.now();

      // Dynamic Animated Transform Scales
      this.currentScale = 1.0;
      this.targetScale = 1.0;
      this.rimIntensity = 0.85;
      this.targetRimIntensity = 0.85;
      this.bloomIntensity = 1.0;
      this.targetBloomIntensity = 1.0;

      // Interactive 3D Cursor Parallax
      this.mouse = { x: 0, y: 0 };
      this.targetMouse = { x: 0, y: 0 };

      // Initialize Micro-Particle Halo
      this.particles = [];
      this.initParticles();

      // Initialize Listeners & Animation Loop
      this.resize();
      this.initEvents();
      this.rafId = requestAnimationFrame(this.render.bind(this));
    }

    initParticles() {
      this.particles = [];
      const count = this.options.particleCount;
      for (let i = 0; i < count; i++) {
        this.particles.push({
          angle: Math.random() * Math.PI * 2,
          distRatio: 1.02 + Math.random() * 0.23, // 1.02x to 1.25x radius
          speed: (0.003 + Math.random() * 0.008) * (Math.random() < 0.5 ? 1 : -1),
          radialDriftSpeed: 0.8 + Math.random() * 1.5,
          radialDriftAmp: 0.01 + Math.random() * 0.025,
          size: 0.5 + Math.random() * 1.3,        // 0.5px to 1.8px
          baseAlpha: 0.25 + Math.random() * 0.65,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    initEvents() {
      this._onResize = () => this.resize();
      window.addEventListener('resize', this._onResize);

      const parent = this.canvas.parentElement;
      if (parent) {
        parent.addEventListener('pointermove', (e) => {
          const rect = this.canvas.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width - 0.5;
          const py = (e.clientY - rect.top) / rect.height - 0.5;
          this.targetMouse.x = clamp(px * 1.8, -0.7, 0.7);
          this.targetMouse.y = clamp(py * 1.8, -0.7, 0.7);
        });

        parent.addEventListener('pointerleave', () => {
          this.targetMouse.x = 0;
          this.targetMouse.y = 0;
        });
      }
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const w = rect.width || 320;
      const h = rect.height || 320;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.width = w;
      this.height = h;
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(h * this.dpr);

      this.ctx.resetTransform();
      this.ctx.scale(this.dpr, this.dpr);

      this.centerX = w / 2;
      this.centerY = h / 2;
      // Core sphere fills ~38% of container leaving safe margin for 1.25x halo & 120px bloom
      this.baseRadius = Math.min(w, h) * 0.36;
    }

    setState(newState) {
      // Accept 'searching' as an alias for 'thinking'
      if (newState === 'searching') newState = 'thinking';
      if (this.state === newState) return;
      this.state = newState;
    }

    setAudioLevel(rms) {
      this.targetAudioLevel = clamp(rms || 0, 0, 1);
    }

    render(timestamp) {
      const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
      this.lastTimestamp = timestamp;
      this.time += dt;

      // -------------------------------------------------------------
      // Linear Interpolation (lerp) for Buttery-Smooth Dynamics
      // -------------------------------------------------------------
      this.audioLevel = lerp(this.audioLevel, this.targetAudioLevel, 0.12);
      this.smoothedAudio = lerp(this.smoothedAudio, this.audioLevel, 0.15);

      this.mouse.x = lerp(this.mouse.x, this.targetMouse.x, 0.08);
      this.mouse.y = lerp(this.mouse.y, this.targetMouse.y, 0.08);

      // State Parameters
      let fluidSpeed = 0.004;
      let membraneSpeed = 1.0;
      let vortexSpeed = 0.0;
      let targetScale = 1.0;
      let targetRimIntensity = 0.85;
      let targetBloomIntensity = 1.0;

      switch (this.state) {
        case 'listening':
          // Base scale expands smoothly to 1.05; rim light intensifies; reacts to audio
          targetScale = 1.05 + this.audioLevel * 0.06;
          targetRimIntensity = 0.95 + this.audioLevel * 0.35;
          targetBloomIntensity = 1.15 + this.audioLevel * 0.45;
          fluidSpeed = 0.006 + this.audioLevel * 0.022;
          membraneSpeed = 1.6 + this.audioLevel * 2.8;
          break;

        case 'thinking':
          // Internal fluid turbulence speeds up; rotational vortex effect
          targetScale = 1.03 + Math.sin(this.time * 3.5) * 0.015;
          targetRimIntensity = 0.90;
          targetBloomIntensity = 1.2;
          fluidSpeed = 0.018;
          membraneSpeed = 2.4;
          vortexSpeed = 0.025;
          break;

        case 'speaking':
          // Rhythmic core brightness and scale pulsing synced to output audio amplitude
          targetScale = 1.0 + this.smoothedAudio * 0.18;
          targetRimIntensity = 0.90 + this.smoothedAudio * 0.40;
          targetBloomIntensity = 1.25 + this.smoothedAudio * 0.75;
          fluidSpeed = 0.010 + this.smoothedAudio * 0.025;
          membraneSpeed = 2.2 + this.smoothedAudio * 3.5;
          break;

        case 'error':
          targetScale = 0.98;
          targetRimIntensity = 0.80;
          targetBloomIntensity = 0.9;
          fluidSpeed = 0.003;
          membraneSpeed = 0.8;
          break;

        case 'idle':
        default:
          // Slow, hypnotic internal fluid swirl; gentle breathing scale (0.98 to 1.02 over 4s)
          const breathing = Math.sin(this.time * (Math.PI * 2 / 4.0)) * 0.02;
          targetScale = 1.0 + breathing;
          targetRimIntensity = 0.80;
          targetBloomIntensity = 0.95;
          fluidSpeed = 0.004;
          membraneSpeed = 1.0;
          break;
      }

      this.currentScale = lerp(this.currentScale, targetScale, 0.09);
      this.rimIntensity = lerp(this.rimIntensity, targetRimIntensity, 0.10);
      this.bloomIntensity = lerp(this.bloomIntensity, targetBloomIntensity, 0.10);

      this.fluidTime += dt * fluidSpeed * 60;
      this.membraneTime += dt * membraneSpeed;
      this.vortexAngle += vortexSpeed;

      // Clear Frame
      this.ctx.clearRect(0, 0, this.width, this.height);

      const cx = this.centerX;
      const cy = this.centerY;
      const r = this.baseRadius * this.currentScale;

      // -------------------------------------------------------------
      // 1. Atmospheric Multi-Layered Outer Bloom
      // -------------------------------------------------------------
      this.drawAtmosphericBloom(cx, cy, r);

      // -------------------------------------------------------------
      // 2. Micro-Particle Halo (Floating micro-dust: 1.02x to 1.25x)
      // -------------------------------------------------------------
      this.drawParticleHalo(cx, cy, r, dt, vortexSpeed);

      // -------------------------------------------------------------
      // 3. Translucent Outer Membrane (2 delicate undulating wave layers)
      // -------------------------------------------------------------
      this.drawOuterMembrane(cx, cy, r);

      // -------------------------------------------------------------
      // 4. Volumetric Frosted Glass Sphere (Clipped to circular mask)
      // -------------------------------------------------------------
      this.drawVolumetricGlassSphere(cx, cy, r);

      // -------------------------------------------------------------
      // 5. Delicate 3D Specular Glint & Reflection Arc
      // -------------------------------------------------------------
      this.drawSpecularGlint(cx, cy, r);

      this.rafId = requestAnimationFrame(this.render.bind(this));
    }

    /**
     * Layer 1: Atmospheric Outer Bloom
     * Multi-layered ambient drop glow against dark background:
     *  - Inner bloom: 0 0 50px rgba(245, 130, 49, 0.35)
     *  - Wide ambient bleed: 0 0 120px rgba(255, 209, 102, 0.12)
     */
    drawAtmosphericBloom(cx, cy, r) {
      const isError = this.state === 'error';
      const bloomScale = this.bloomIntensity;

      // Wide ambient bleed (120px)
      const wideRadius = r + 120 * bloomScale;
      const wideGrad = this.ctx.createRadialGradient(cx, cy, r * 0.65, cx, cy, wideRadius);
      if (isError) {
        wideGrad.addColorStop(0, 'rgba(239, 68, 68, 0.18)');
        wideGrad.addColorStop(0.5, 'rgba(220, 38, 38, 0.06)');
        wideGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        wideGrad.addColorStop(0, `rgba(255, 209, 102, ${0.12 * bloomScale})`);
        wideGrad.addColorStop(0.55, `rgba(245, 130, 49, ${0.05 * bloomScale})`);
        wideGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      this.ctx.save();
      this.ctx.fillStyle = wideGrad;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, wideRadius, 0, Math.PI * 2);
      this.ctx.fill();

      // Inner concentrated bloom (50px)
      const innerRadius = r + 50 * bloomScale;
      const innerGrad = this.ctx.createRadialGradient(cx, cy, r * 0.75, cx, cy, innerRadius);
      if (isError) {
        innerGrad.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
        innerGrad.addColorStop(0.7, 'rgba(220, 38, 38, 0.10)');
        innerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        innerGrad.addColorStop(0, `rgba(245, 130, 49, ${0.35 * bloomScale})`);
        innerGrad.addColorStop(0.75, `rgba(245, 130, 49, ${0.08 * bloomScale})`);
        innerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      this.ctx.fillStyle = innerGrad;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    /**
     * Layer 2: Micro-Particle Halo
     * 60-100 tiny micro-dust particles (0.5px to 1.8px, #FFE8B3) floating and slowly
     * drifting in the immediate outer glow radius (1.02x to 1.25x), fading out via distance.
     */
    drawParticleHalo(cx, cy, r, dt, vortexSpeed) {
      const isError = this.state === 'error';
      const particleBaseColor = isError ? '254, 202, 202' : '255, 232, 179';

      this.ctx.save();
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];

        // Angular drift + vortex effect
        p.angle += (p.speed + vortexSpeed) * dt * 60;

        // Subtle radial breathing drift
        const radialPulse = Math.sin(this.time * p.radialDriftSpeed + p.phase) * p.radialDriftAmp;
        const currentDistRatio = p.distRatio + radialPulse;
        const dist = r * currentDistRatio;

        const px = cx + Math.cos(p.angle) * dist;
        const py = cy + Math.sin(p.angle) * dist;

        // Alpha distance falloff (fades out as it approaches 1.25x outer boundary)
        const normalizedDist = (currentDistRatio - 1.02) / 0.23; // 0.0 at edge, 1.0 at outer rim
        const distFade = clamp(1.0 - normalizedDist, 0, 1);
        const alpha = p.baseAlpha * distFade * clamp(this.rimIntensity * 0.9, 0.2, 1.0);

        this.ctx.fillStyle = `rgba(${particleBaseColor}, ${alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(px, py, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    /**
     * Layer 3: Translucent Outer Membrane
     * 2 delicate semi-transparent organic wave layers (opacity ~0.25) gently undulating
     * outside the main sphere radius using smooth sine noise for a living liquid membrane feel.
     */
    drawOuterMembrane(cx, cy, r) {
      const isError = this.state === 'error';
      const segments = 36;
      const angleStep = (Math.PI * 2) / segments;

      // Membrane Wave Layer 1 (Warm Amber/Peach sheen)
      this.ctx.save();
      this.ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const theta = i * angleStep;
        const wave1 = Math.sin(theta * 3 + this.membraneTime * 1.4) * 0.022;
        const wave2 = Math.cos(theta * 2 - this.membraneTime * 0.9) * 0.015;
        const memR = r * (1.025 + (wave1 + wave2) * (1 + this.audioLevel * 1.2));

        const x = cx + Math.cos(theta) * memR;
        const y = cy + Math.sin(theta) * memR;

        if (i === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.closePath();
      this.ctx.strokeStyle = isError
        ? 'rgba(248, 113, 113, 0.22)'
        : `rgba(245, 130, 49, ${0.25 * clamp(this.rimIntensity, 0.6, 1.4)})`;
      this.ctx.lineWidth = 1.8;
      this.ctx.stroke();

      // Membrane Wave Layer 2 (Soft Golden outer arc, slightly offset)
      this.ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const theta = i * angleStep;
        const waveA = Math.cos(theta * 4 - this.membraneTime * 1.1) * 0.020;
        const waveB = Math.sin(theta * 2 + this.membraneTime * 0.7) * 0.012;
        const memR = r * (1.038 + (waveA + waveB) * (1 + this.audioLevel * 1.0));

        const x = cx + Math.cos(theta) * memR;
        const y = cy + Math.sin(theta) * memR;

        if (i === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.closePath();
      this.ctx.strokeStyle = isError
        ? 'rgba(252, 165, 165, 0.16)'
        : `rgba(255, 209, 102, ${0.18 * clamp(this.rimIntensity, 0.5, 1.2)})`;
      this.ctx.lineWidth = 1.4;
      this.ctx.stroke();
      this.ctx.restore();
    }

    /**
     * Layer 4: Volumetric Frosted Glass Sphere
     * Rendered inside a circular clipping mask:
     *  - Internal volumetric fluid: 4 overlapping organic color blobs
     *    - Core Highlight: Soft Gold (#FFD166)
     *    - Primary Midtone: Warm Amber (#F58231)
     *    - Secondary Midtone: Soft Peach (#FFAD87)
     *    - Deep Valley Shadow: Burnt Sienna (#3A1405) for 3D depth and contrast
     *  - Soft Fresnel Rim Light: Inner glow along the circumference feathering inward (28px)
     */
    drawVolumetricGlassSphere(cx, cy, r) {
      const isError = this.state === 'error';
      const t = this.fluidTime;

      // 3D Lighting and Cursor Parallax Offset
      const lightTiltX = this.mouse.x * r * 0.18;
      const lightTiltY = this.mouse.y * r * 0.18;

      this.ctx.save();
      // Clip everything strictly to the circular frosted glass sphere
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.clip();

      // -----------------------------------------------------------
      // A. Deep Atmospheric Base Gradient (Spherical Volume Foundation)
      // -----------------------------------------------------------
      const baseGrad = this.ctx.createRadialGradient(
        cx - r * 0.25 + lightTiltX, cy - r * 0.30 + lightTiltY, r * 0.05,
        cx, cy, r * 1.02
      );
      if (isError) {
        baseGrad.addColorStop(0, '#fca5a5');
        baseGrad.addColorStop(0.35, '#ef4444');
        baseGrad.addColorStop(0.70, '#b91c1c');
        baseGrad.addColorStop(1.0, '#450a0a');
      } else {
        baseGrad.addColorStop(0, '#FFD166');    // Soft Gold
        baseGrad.addColorStop(0.32, '#F58231'); // Warm Amber
        baseGrad.addColorStop(0.68, '#C24A0E'); // Rich Amber Shadow
        baseGrad.addColorStop(1.0, '#3A1405');  // Burnt Sienna (Deep Valley Shadow)
      }
      this.ctx.fillStyle = baseGrad;
      this.ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      // -----------------------------------------------------------
      // B. 4 Overlapping Organic Fluid Blobs (Cloudy Core Nebula)
      // -----------------------------------------------------------
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'screen';

      // Blob 1: Deep Valley Shadow & Contrast Sculptor (orbiting lower-right)
      const b1Angle = t * 0.8 + Math.PI * 0.25;
      const b1X = cx + Math.cos(b1Angle) * r * 0.35 + lightTiltX;
      const b1Y = cy + Math.sin(b1Angle) * r * 0.35 + lightTiltY;
      const b1R = r * 0.70;
      const b1Grad = this.ctx.createRadialGradient(b1X, b1Y, 0, b1X, b1Y, b1R);
      b1Grad.addColorStop(0, isError ? 'rgba(185, 28, 28, 0.7)' : 'rgba(194, 65, 12, 0.65)');
      b1Grad.addColorStop(0.6, isError ? 'rgba(127, 29, 29, 0.3)' : 'rgba(124, 45, 18, 0.3)');
      b1Grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = b1Grad;
      this.ctx.beginPath();
      this.ctx.arc(b1X, b1Y, b1R, 0, Math.PI * 2);
      this.ctx.fill();

      // Blob 2: Primary Midtone (Warm Amber #F58231, swirling in lower-mid zone)
      const b2Angle = -t * 0.65 + Math.PI * 0.8;
      const b2X = cx + Math.cos(b2Angle) * r * 0.40 + lightTiltX;
      const b2Y = cy + Math.sin(b2Angle) * r * 0.40 + lightTiltY;
      const b2R = r * 0.65;
      const b2Grad = this.ctx.createRadialGradient(b2X, b2Y, 0, b2X, b2Y, b2R);
      b2Grad.addColorStop(0, isError ? 'rgba(239, 68, 68, 0.8)' : 'rgba(245, 130, 49, 0.85)');
      b2Grad.addColorStop(0.65, isError ? 'rgba(220, 38, 38, 0.3)' : 'rgba(245, 130, 49, 0.25)');
      b2Grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = b2Grad;
      this.ctx.beginPath();
      this.ctx.arc(b2X, b2Y, b2R, 0, Math.PI * 2);
      this.ctx.fill();

      // Blob 3: Secondary Midtone (Soft Peach #FFAD87, floating center-left)
      const b3Angle = t * 1.1 + Math.PI * 1.4;
      const b3X = cx + Math.cos(b3Angle) * r * 0.32 + lightTiltX;
      const b3Y = cy + Math.sin(b3Angle) * r * 0.32 + lightTiltY;
      const b3R = r * 0.55;
      const b3Grad = this.ctx.createRadialGradient(b3X, b3Y, 0, b3X, b3Y, b3R);
      b3Grad.addColorStop(0, isError ? 'rgba(252, 165, 165, 0.75)' : 'rgba(255, 173, 135, 0.75)');
      b3Grad.addColorStop(0.55, isError ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 173, 135, 0.2)');
      b3Grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = b3Grad;
      this.ctx.beginPath();
      this.ctx.arc(b3X, b3Y, b3R, 0, Math.PI * 2);
      this.ctx.fill();

      // Blob 4: Core Highlight (Soft Gold #FFD166, floating upper-center)
      const b4Angle = -t * 0.95 + Math.PI * 0.15;
      const b4X = cx + Math.cos(b4Angle) * r * 0.25 + lightTiltX;
      const b4Y = cy + Math.sin(b4Angle) * r * 0.25 + lightTiltY;
      const b4R = r * 0.50;
      const b4Grad = this.ctx.createRadialGradient(b4X, b4Y, 0, b4X, b4Y, b4R);
      b4Grad.addColorStop(0, isError ? 'rgba(254, 226, 226, 0.95)' : 'rgba(255, 209, 102, 0.92)');
      b4Grad.addColorStop(0.5, isError ? 'rgba(248, 113, 113, 0.4)' : 'rgba(255, 209, 102, 0.35)');
      b4Grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = b4Grad;
      this.ctx.beginPath();
      this.ctx.arc(b4X, b4Y, b4R, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore(); // Restore from 'screen' mode

      // -----------------------------------------------------------
      // C. Soft Fresnel Rim Light (Inner glow feathering inward 28px)
      // -----------------------------------------------------------
      // Completely eliminates harsh solid borders and provides silky frosted glass edge
      const rimWidth = Math.min(28, r * 0.28);
      const fresnelGrad = this.ctx.createRadialGradient(cx, cy, r - rimWidth, cx, cy, r);
      const rimColor = isError ? '255, 228, 230' : '255, 245, 214'; // Warm ivory gold
      const rimAlpha = clamp(this.rimIntensity, 0.5, 1.25);

      fresnelGrad.addColorStop(0, `rgba(${rimColor}, 0)`);
      fresnelGrad.addColorStop(0.40, `rgba(${rimColor}, ${0.15 * rimAlpha})`);
      fresnelGrad.addColorStop(0.75, `rgba(${rimColor}, ${0.55 * rimAlpha})`);
      fresnelGrad.addColorStop(0.95, `rgba(${rimColor}, ${0.85 * rimAlpha})`);
      fresnelGrad.addColorStop(1.0, `rgba(${rimColor}, ${0.95 * rimAlpha})`);

      this.ctx.fillStyle = fresnelGrad;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.fill();

      // -----------------------------------------------------------
      // D. Directional Fresnel Crescent (Bright highlight along upper-left)
      // -----------------------------------------------------------
      const crescentGrad = this.ctx.createLinearGradient(
        cx - r * 0.8, cy - r * 0.8,
        cx + r * 0.8, cy + r * 0.8
      );
      crescentGrad.addColorStop(0, `rgba(${rimColor}, ${0.80 * rimAlpha})`);
      crescentGrad.addColorStop(0.4, `rgba(${rimColor}, ${0.25 * rimAlpha})`);
      crescentGrad.addColorStop(0.7, 'rgba(255, 245, 214, 0)');
      crescentGrad.addColorStop(1, 'rgba(255, 245, 214, 0)');

      this.ctx.save();
      this.ctx.strokeStyle = crescentGrad;
      this.ctx.lineWidth = 2.4;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r - 1.2, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();

      this.ctx.restore(); // Restore circular clip
    }

    /**
     * Layer 5: Specular Glint & Reflection Arc
     * Delicate surface caustics providing tactile glass realism.
     */
    drawSpecularGlint(cx, cy, r) {
      const isError = this.state === 'error';
      const glintX = cx - r * 0.28 + this.mouse.x * r * 0.15;
      const glintY = cy - r * 0.32 + this.mouse.y * r * 0.15;
      const glintRadius = r * 0.38;

      const glintGrad = this.ctx.createRadialGradient(
        glintX, glintY, 0,
        glintX, glintY, glintRadius
      );
      const glintColor = isError ? '254, 226, 226' : '255, 255, 255';
      glintGrad.addColorStop(0, `rgba(${glintColor}, ${0.52 * this.rimIntensity})`);
      glintGrad.addColorStop(0.35, `rgba(${glintColor}, ${0.16 * this.rimIntensity})`);
      glintGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      this.ctx.save();
      this.ctx.fillStyle = glintGrad;
      this.ctx.beginPath();
      this.ctx.arc(glintX, glintY, glintRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    destroy() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      window.removeEventListener('resize', this._onResize);
    }
  }

  // Export both class names for seamless compatibility
  window.VoiceOrbVisualizer = VoiceOrbVisualizer;
  window.OrbVisualizer = VoiceOrbVisualizer;
})(window);
