/**
 * Piston Voice RAG — Volumetric Frosted-Glass Voice Orb Visualizer
 *
 * Implements a hyper-realistic, volumetric frosted-glass sphere with organic
 * fluid nebula swirls, delicate glass rim reflections, crescent aura, and micro-stardust.
 *
 * Exact replication of Image 2:
 *  - Ethereal, translucent glass bubble filled with warm glowing fluid smoke
 *  - Soft off-center nebula clouds (Champagne Gold, Warm Honey, Peach, Smoky Umber)
 *  - Zero eyeball/pupil/iris artifacts: completely asymmetric organic cloud dynamics
 *  - Delicate 1.2px champagne-gold perimeter rim with feathered Fresnel grazing light
 *  - Signature luminous outer crescent aura on the right curvature
 *  - Floating micro-stardust halo (0.5px - 1.4px, soft warm flecks)
 *  - Multi-layered atmospheric drop bloom (50px inner, 100px wide ambient bleed)
 *  - 60 FPS linear interpolation (lerp) state machine (idle, listening, thinking, speaking)
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
        particleCount: 55,
      }, options);

      this.width = 0;
      this.height = 0;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.centerX = 0;
      this.centerY = 0;
      this.baseRadius = 110;

      // State machine: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
      this.state = 'idle';

      // Audio reactivity with smooth linear interpolation
      this.audioLevel = 0.0;
      this.targetAudioLevel = 0.0;
      this.smoothedAudio = 0.0;

      // Animation clocks & fluid speeds
      this.time = 0;
      this.fluidTime = 0;
      this.membraneTime = 0;
      this.lastTimestamp = performance.now();

      // Dynamic scales and intensities
      this.currentScale = 1.0;
      this.targetScale = 1.0;
      this.rimIntensity = 0.85;
      this.targetRimIntensity = 0.85;
      this.bloomIntensity = 1.0;
      this.targetBloomIntensity = 1.0;

      // Interactive 3D Cursor Parallax
      this.mouse = { x: 0, y: 0 };
      this.targetMouse = { x: 0, y: 0 };

      // Initialize Micro-Stardust Particles
      this.particles = [];
      this.initParticles();

      // Setup Listeners and Animation Loop
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
          distRatio: 1.03 + Math.random() * 0.18, // 1.03x to 1.21x radius
          speed: (0.002 + Math.random() * 0.006) * (Math.random() < 0.5 ? 1 : -1),
          radialDriftSpeed: 0.6 + Math.random() * 1.2,
          radialDriftAmp: 0.008 + Math.random() * 0.015,
          size: 0.5 + Math.random() * 1.0,        // 0.5px to 1.5px subtle stardust
          baseAlpha: 0.20 + Math.random() * 0.50,
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
          this.targetMouse.x = clamp(px * 1.6, -0.6, 0.6);
          this.targetMouse.y = clamp(py * 1.6, -0.6, 0.6);
        });

        parent.addEventListener('pointerleave', () => {
          this.targetMouse.x = 0;
          this.targetMouse.y = 0;
        });
      }
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const w = rect.width || 340;
      const h = rect.height || 340;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.width = w;
      this.height = h;
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(h * this.dpr);

      this.ctx.resetTransform();
      this.ctx.scale(this.dpr, this.dpr);

      this.centerX = w / 2;
      this.centerY = h / 2;
      // Core sphere fills ~37% of container, leaving ample room for outer crescent and bloom
      this.baseRadius = Math.min(w, h) * 0.37;
    }

    setState(newState) {
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
      // Smooth Dynamics via Linear Interpolation (lerp)
      // -------------------------------------------------------------
      this.audioLevel = lerp(this.audioLevel, this.targetAudioLevel, 0.12);
      this.smoothedAudio = lerp(this.smoothedAudio, this.audioLevel, 0.15);

      this.mouse.x = lerp(this.mouse.x, this.targetMouse.x, 0.08);
      this.mouse.y = lerp(this.mouse.y, this.targetMouse.y, 0.08);

      // State Parameters
      let fluidSpeed = 0.0035;
      let membraneSpeed = 0.8;
      let vortexSpeed = 0.0;
      let targetScale = 1.0;
      let targetRimIntensity = 0.85;
      let targetBloomIntensity = 1.0;

      switch (this.state) {
        case 'listening':
          targetScale = 1.04 + this.audioLevel * 0.05;
          targetRimIntensity = 0.95 + this.audioLevel * 0.30;
          targetBloomIntensity = 1.15 + this.audioLevel * 0.40;
          fluidSpeed = 0.005 + this.audioLevel * 0.018;
          membraneSpeed = 1.4 + this.audioLevel * 2.2;
          break;

        case 'thinking':
          targetScale = 1.02 + Math.sin(this.time * 3.0) * 0.012;
          targetRimIntensity = 0.90;
          targetBloomIntensity = 1.20;
          fluidSpeed = 0.014;
          membraneSpeed = 2.0;
          vortexSpeed = 0.020;
          break;

        case 'speaking':
          targetScale = 1.0 + this.smoothedAudio * 0.14;
          targetRimIntensity = 0.90 + this.smoothedAudio * 0.35;
          targetBloomIntensity = 1.20 + this.smoothedAudio * 0.65;
          fluidSpeed = 0.008 + this.smoothedAudio * 0.020;
          membraneSpeed = 1.8 + this.smoothedAudio * 2.8;
          break;

        case 'error':
          targetScale = 0.98;
          targetRimIntensity = 0.75;
          targetBloomIntensity = 0.85;
          fluidSpeed = 0.0025;
          membraneSpeed = 0.6;
          break;

        case 'idle':
        default:
          // Subtle breathing (0.985 to 1.015 over 4 seconds)
          const breathing = Math.sin(this.time * (Math.PI * 2 / 4.0)) * 0.015;
          targetScale = 1.0 + breathing;
          targetRimIntensity = 0.80;
          targetBloomIntensity = 0.95;
          fluidSpeed = 0.0035;
          membraneSpeed = 0.8;
          break;
      }

      this.currentScale = lerp(this.currentScale, targetScale, 0.08);
      this.rimIntensity = lerp(this.rimIntensity, targetRimIntensity, 0.09);
      this.bloomIntensity = lerp(this.bloomIntensity, targetBloomIntensity, 0.09);

      this.fluidTime += dt * fluidSpeed * 60;
      this.membraneTime += dt * membraneSpeed;

      // Clear Canvas
      this.ctx.clearRect(0, 0, this.width, this.height);

      const cx = this.centerX;
      const cy = this.centerY;
      const r = this.baseRadius * this.currentScale;

      // -------------------------------------------------------------
      // 1. Soft Ambient Background Glow (Feathered dark atmosphere)
      // -------------------------------------------------------------
      this.drawAmbientAtmosphere(cx, cy, r);

      // -------------------------------------------------------------
      // 2. Luminous Outer Crescent Sheen (Image 2 signature effect)
      // -------------------------------------------------------------
      this.drawOuterCrescentSheen(cx, cy, r);

      // -------------------------------------------------------------
      // 3. Floating Micro-Stardust Halo
      // -------------------------------------------------------------
      this.drawStardustHalo(cx, cy, r, dt, vortexSpeed);

      // -------------------------------------------------------------
      // 4. Translucent Outer Wave Membrane (Subtle organic edge)
      // -------------------------------------------------------------
      this.drawOuterFluidMembrane(cx, cy, r);

      // -------------------------------------------------------------
      // 5. Volumetric Frosted Glass Sphere (Cloudy nebula core)
      // -------------------------------------------------------------
      this.drawVolumetricGlassCore(cx, cy, r);

      // -------------------------------------------------------------
      // 6. Surface Glass Reflections & Caustic Sheen
      // -------------------------------------------------------------
      this.drawSurfaceGlassReflections(cx, cy, r);

      this.rafId = requestAnimationFrame(this.render.bind(this));
    }

    /**
     * Layer 1: Soft Ambient Background Atmosphere
     * Smoothly diffuses warm amber/gold lighting into the dark background.
     */
    drawAmbientAtmosphere(cx, cy, r) {
      const isError = this.state === 'error';
      const bloom = this.bloomIntensity;
      const maxRadius = r + 110 * bloom;

      const grad = this.ctx.createRadialGradient(cx, cy, r * 0.70, cx, cy, maxRadius);
      if (isError) {
        grad.addColorStop(0, `rgba(220, 38, 38, ${0.18 * bloom})`);
        grad.addColorStop(0.55, `rgba(185, 28, 28, ${0.05 * bloom})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        grad.addColorStop(0, `rgba(245, 158, 11, ${0.16 * bloom})`);
        grad.addColorStop(0.50, `rgba(217, 119, 6, ${0.05 * bloom})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      this.ctx.save();
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    /**
     * Layer 2: Luminous Outer Crescent Sheen
     * As seen in Image 2: a soft warm crescent halo wrapping around the right curvature.
     */
    drawOuterCrescentSheen(cx, cy, r) {
      const isError = this.state === 'error';
      const t = this.membraneTime;

      this.ctx.save();
      this.ctx.globalCompositeOperation = 'screen';

      // Crescent center is slightly offset to the right
      const crescentCenterAngle = -Math.PI * 0.08 + Math.sin(t * 0.6) * 0.06;
      const crescentX = cx + Math.cos(crescentCenterAngle) * (r * 0.22);
      const crescentY = cy + Math.sin(crescentCenterAngle) * (r * 0.22);
      const crescentRadius = r * 1.14 + (this.audioLevel * 10);

      const grad = this.ctx.createRadialGradient(
        crescentX, crescentY, r * 0.78,
        cx, cy, crescentRadius
      );

      const alpha = clamp(this.bloomIntensity * 0.40, 0.15, 0.65);
      if (isError) {
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.80, `rgba(239, 68, 68, ${alpha * 0.6})`);
        grad.addColorStop(0.96, `rgba(252, 165, 165, ${alpha})`);
        grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      } else {
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.80, `rgba(245, 158, 11, ${alpha * 0.6})`);
        grad.addColorStop(0.96, `rgba(254, 240, 138, ${alpha})`);
        grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      }

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, crescentRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    /**
     * Layer 3: Floating Micro-Stardust Halo
     * Faint, tiny warm stardust flecks (0.5px to 1.5px) drifting near the glass boundary.
     */
    drawStardustHalo(cx, cy, r, dt, vortexSpeed) {
      const isError = this.state === 'error';
      const rgb = isError ? '252, 165, 165' : '254, 243, 199';

      this.ctx.save();
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        p.angle += (p.speed + vortexSpeed) * dt * 60;

        const radialShift = Math.sin(this.time * p.radialDriftSpeed + p.phase) * p.radialDriftAmp;
        const curDistRatio = p.distRatio + radialShift;
        const dist = r * curDistRatio;

        const px = cx + Math.cos(p.angle) * dist;
        const py = cy + Math.sin(p.angle) * dist;

        // Soft distance falloff
        const normDist = (curDistRatio - 1.03) / 0.18;
        const fade = clamp(1.0 - normDist, 0, 1);
        const alpha = p.baseAlpha * fade * clamp(this.rimIntensity, 0.4, 1.1);

        this.ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(px, py, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    /**
     * Layer 4: Translucent Outer Fluid Membrane
     * 2 delicate semi-transparent organic wave paths (opacity ~0.18) undulating just outside the rim.
     */
    drawOuterFluidMembrane(cx, cy, r) {
      const isError = this.state === 'error';
      const segments = 32;
      const angleStep = (Math.PI * 2) / segments;
      const t = this.membraneTime;

      this.ctx.save();
      this.ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const theta = i * angleStep;
        const w1 = Math.sin(theta * 3 + t * 1.2) * 0.016;
        const w2 = Math.cos(theta * 2 - t * 0.8) * 0.012;
        const memR = r * (1.020 + (w1 + w2) * (1 + this.audioLevel * 1.0));

        const x = cx + Math.cos(theta) * memR;
        const y = cy + Math.sin(theta) * memR;

        if (i === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.closePath();

      const alpha = 0.22 * clamp(this.rimIntensity, 0.5, 1.3);
      this.ctx.strokeStyle = isError
        ? `rgba(248, 113, 113, ${alpha})`
        : `rgba(245, 158, 11, ${alpha})`;
      this.ctx.lineWidth = 1.4;
      this.ctx.stroke();
      this.ctx.restore();
    }

    /**
     * Layer 5: Volumetric Frosted Glass Sphere Core
     * The heart of Image 2:
     *  - Clipped strictly to circular sphere boundary
     *  - Soft diagonal atmospheric color wash (warm champagne to deep amber)
     *  - Multiple large, softly blurred organic nebula clusters drifting asynchronously
     *  - Smoky shadow veil in upper-left creating asymmetric 3D depth (NO EYEBALL!)
     *  - Delicate 1.2px champagne glass perimeter rim with feathered Fresnel grazing light
     */
    drawVolumetricGlassCore(cx, cy, r) {
      const isError = this.state === 'error';
      const t = this.fluidTime;

      // Parallax 3D tilt tracking cursor
      const tiltX = this.mouse.x * r * 0.12;
      const tiltY = this.mouse.y * r * 0.12;

      this.ctx.save();
      // Clip to circular glass sphere
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.clip();

      // -------------------------------------------------------------
      // A. Spherical Atmospheric Foundation Wash (Smooth diagonal flow)
      // -------------------------------------------------------------
      const bgGrad = this.ctx.createLinearGradient(
        cx - r * 0.8 + tiltX, cy - r * 0.8 + tiltY,
        cx + r * 0.8, cy + r * 0.8
      );
      if (isError) {
        bgGrad.addColorStop(0, '#f87171');
        bgGrad.addColorStop(0.40, '#dc2626');
        bgGrad.addColorStop(0.75, '#991b1b');
        bgGrad.addColorStop(1.0, '#450a0a');
      } else {
        bgGrad.addColorStop(0, '#F59E0B');    // Warm Amber
        bgGrad.addColorStop(0.35, '#D97706'); // Deep Golden Amber
        bgGrad.addColorStop(0.70, '#B45309'); // Rich Warm Bronze
        bgGrad.addColorStop(1.0, '#3A1C0E');  // Deep Smoky Amber Umber
      }
      this.ctx.fillStyle = bgGrad;
      this.ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      // -------------------------------------------------------------
      // B. Organic Nebula Clusters (Cloudy fluid smoke drifting naturally)
      // -------------------------------------------------------------
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'screen';

      // Nebula 1: Warm Champagne Golden Cloud (drifting in center-right)
      const n1Angle = t * 0.75 + Math.PI * 0.2;
      const n1X = cx + Math.cos(n1Angle) * r * 0.28 + tiltX;
      const n1Y = cy + Math.sin(n1Angle) * r * 0.22 + tiltY;
      const n1R = r * 0.85;
      const n1Grad = this.ctx.createRadialGradient(n1X, n1Y, 0, n1X, n1Y, n1R);
      if (isError) {
        n1Grad.addColorStop(0, 'rgba(254, 202, 202, 0.85)');
        n1Grad.addColorStop(0.50, 'rgba(239, 68, 68, 0.35)');
        n1Grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      } else {
        n1Grad.addColorStop(0, 'rgba(254, 240, 138, 0.85)'); // Soft Pale Gold
        n1Grad.addColorStop(0.45, 'rgba(245, 158, 11, 0.40)'); // Amber
        n1Grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      }
      this.ctx.fillStyle = n1Grad;
      this.ctx.beginPath();
      this.ctx.arc(n1X, n1Y, n1R, 0, Math.PI * 2);
      this.ctx.fill();

      // Nebula 2: Peach-Honey Glow (swirling along lower curve)
      const n2Angle = -t * 0.60 + Math.PI * 0.9;
      const n2X = cx + Math.cos(n2Angle) * r * 0.32 + tiltX;
      const n2Y = cy + Math.sin(n2Angle) * r * 0.28 + tiltY;
      const n2R = r * 0.75;
      const n2Grad = this.ctx.createRadialGradient(n2X, n2Y, 0, n2X, n2Y, n2R);
      if (isError) {
        n2Grad.addColorStop(0, 'rgba(252, 165, 165, 0.75)');
        n2Grad.addColorStop(0.55, 'rgba(220, 38, 38, 0.25)');
        n2Grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      } else {
        n2Grad.addColorStop(0, 'rgba(251, 146, 60, 0.80)'); // Warm Peach
        n2Grad.addColorStop(0.55, 'rgba(217, 119, 6, 0.30)'); // Amber
        n2Grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      }
      this.ctx.fillStyle = n2Grad;
      this.ctx.beginPath();
      this.ctx.arc(n2X, n2Y, n2R, 0, Math.PI * 2);
      this.ctx.fill();

      // Nebula 3: Radiant Core Sheen (sweeping through lower-center)
      const n3Angle = t * 1.05 + Math.PI * 1.6;
      const n3X = cx + Math.cos(n3Angle) * r * 0.20 + tiltX;
      const n3Y = cy + Math.sin(n3Angle) * r * 0.25 + tiltY;
      const n3R = r * 0.60;
      const n3Grad = this.ctx.createRadialGradient(n3X, n3Y, 0, n3X, n3Y, n3R);
      if (isError) {
        n3Grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
        n3Grad.addColorStop(0.45, 'rgba(254, 202, 202, 0.30)');
        n3Grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      } else {
        n3Grad.addColorStop(0, 'rgba(255, 251, 235, 0.90)'); // Radiant Warm Ivory
        n3Grad.addColorStop(0.40, 'rgba(253, 224, 71, 0.35)'); // Soft Gold
        n3Grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
      }
      this.ctx.fillStyle = n3Grad;
      this.ctx.beginPath();
      this.ctx.arc(n3X, n3Y, n3R, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();

      // -------------------------------------------------------------
      // C. Asymmetric Smoky Shadow Veil (Crucial for 3D depth, destroys eyeball!)
      // -------------------------------------------------------------
      // A soft, subtle, cloudy dark umber wash in upper-left and bottom-right crevices
      this.ctx.save();
      const shadowAngle = t * 0.45 + Math.PI * 1.1;
      const sX = cx + Math.cos(shadowAngle) * r * 0.30;
      const sY = cy + Math.sin(shadowAngle) * r * 0.30;
      const sR = r * 0.85;

      const shadowGrad = this.ctx.createRadialGradient(sX, sY, r * 0.1, sX, sY, sR);
      shadowGrad.addColorStop(0, 'rgba(26, 12, 6, 0.55)');
      shadowGrad.addColorStop(0.60, 'rgba(26, 12, 6, 0.20)');
      shadowGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      this.ctx.fillStyle = shadowGrad;
      this.ctx.beginPath();
      this.ctx.arc(sX, sY, sR, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();

      // -------------------------------------------------------------
      // D. Delicate Glass Rim & Feathered Grazing Light
      // -------------------------------------------------------------
      // Replaces thick white ring with a subtle 12px feathered inner rim gradient
      const rimWidth = Math.min(14, r * 0.15);
      const fresnelGrad = this.ctx.createRadialGradient(cx, cy, r - rimWidth, cx, cy, r);
      const rimColor = isError ? '254, 202, 202' : '254, 243, 199'; // Warm champagne ivory
      const alpha = clamp(this.rimIntensity * 0.65, 0.35, 0.90);

      fresnelGrad.addColorStop(0, `rgba(${rimColor}, 0)`);
      fresnelGrad.addColorStop(0.50, `rgba(${rimColor}, ${0.15 * alpha})`);
      fresnelGrad.addColorStop(0.85, `rgba(${rimColor}, ${0.45 * alpha})`);
      fresnelGrad.addColorStop(1.0, `rgba(${rimColor}, ${0.75 * alpha})`);

      this.ctx.fillStyle = fresnelGrad;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.fill();

      // Delicate 1.2px glass perimeter boundary line
      this.ctx.strokeStyle = `rgba(${rimColor}, ${0.60 * alpha})`;
      this.ctx.lineWidth = 1.2;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r - 0.6, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.restore(); // Restore circular clipping mask
    }

    /**
     * Layer 6: Surface Glass Caustics & Reflection
     * Soft, diffused elliptical glint near upper curve simulating polished glass.
     */
    drawSurfaceGlassReflections(cx, cy, r) {
      const isError = this.state === 'error';
      const glintX = cx - r * 0.22 + this.mouse.x * r * 0.10;
      const glintY = cy - r * 0.26 + this.mouse.y * r * 0.10;
      const glintRadius = r * 0.42;

      const glintGrad = this.ctx.createRadialGradient(
        glintX, glintY, 0,
        glintX, glintY, glintRadius
      );
      const glintColor = isError ? '254, 226, 226' : '255, 255, 255';
      const alpha = 0.30 * clamp(this.rimIntensity, 0.6, 1.2);

      glintGrad.addColorStop(0, `rgba(${glintColor}, ${alpha})`);
      glintGrad.addColorStop(0.40, `rgba(${glintColor}, ${alpha * 0.35})`);
      glintGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0)');

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

  // Export both names for backwards compatibility
  window.VoiceOrbVisualizer = VoiceOrbVisualizer;
  window.OrbVisualizer = VoiceOrbVisualizer;
})(window);
