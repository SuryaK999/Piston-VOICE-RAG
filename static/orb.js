/**
 * Piston Voice RAG - World-Class Canvas Visualizer Orb
 * High-fidelity 60FPS fluid audio-reactive visualizer inspired by modern state-of-the-art
 * AI interfaces (ChatGPT Advanced Voice, Apple Intelligence, Siri).
 *
 * Features:
 *  - Organic multi-octave harmonic fluid membrane with cubic bezier smoothing
 *  - Volumetric atmospheric lighting (casts deep cinematic aura on dark canvas)
 *  - Dynamic 3D specular light tracking cursor with spring physics
 *  - Audio-reactive acoustic ripple waves & floating particle sparkles
 *  - Zero-lag retina / high-DPI auto-scaling
 */

(function (window) {
  'use strict';

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const lerp = (a, b, t) => a + (b - a) * t;

  class OrbVisualizer {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true });
      this.options = Object.assign({
        maxParticles: 36,
        baseDamping: 0.12,
      }, options);

      this.width = 0;
      this.height = 0;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.centerX = 0;
      this.centerY = 0;
      this.baseRadius = 110;

      // State management
      this.state = 'idle'; // 'idle' | 'listening' | 'searching' | 'speaking' | 'error'
      this.targetState = 'idle';

      // Audio RMS & reactivity
      this.rms = 0;
      this.smoothRms = 0;
      this.energy = 0;

      // 3D tilt tracking cursor
      this.targetMouse = { x: 0, y: 0 };
      this.mouse = { x: 0, y: 0 };
      this.isHovered = false;

      // Time & wave harmonics
      this.time = 0;
      this.lastTimestamp = performance.now();

      // Zero-allocation particle pool
      this.maxParticles = this.options.maxParticles;
      this.particles = new Float32Array(this.maxParticles * 6); // [x, y, vx, vy, life, maxLife]
      this.activeParticles = 0;

      // Acoustic ripple rings
      this.maxRipples = 4;
      this.ripples = [];
      for (let i = 0; i < this.maxRipples; i++) {
        this.ripples.push({ radius: 0, opacity: 0, speed: 0, active: false });
      }

      this.resize();
      this.initEvents();
      this.rafId = requestAnimationFrame(this.render.bind(this));
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
          this.targetMouse.x = clamp(px * 2, -1, 1);
          this.targetMouse.y = clamp(py * 2, -1, 1);
          this.isHovered = true;
        });

        parent.addEventListener('pointerleave', () => {
          this.targetMouse.x = 0;
          this.targetMouse.y = 0;
          this.isHovered = false;
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
      // Core fills ~44% of the container, leaving room for radiant bloom
      this.baseRadius = Math.min(w, h) * 0.40;
    }

    setState(newState) {
      if (this.state === newState) return;
      this.state = newState;
    }

    setAudioLevel(rms) {
      this.rms = clamp(rms || 0, 0, 1);
    }

    triggerRipple(speed = 2.2) {
      for (let i = 0; i < this.maxRipples; i++) {
        const r = this.ripples[i];
        if (!r.active) {
          r.active = true;
          r.radius = this.baseRadius * 0.95;
          r.opacity = 0.6;
          r.speed = speed;
          break;
        }
      }
    }

    spawnParticle(angle, speed, dist, life) {
      if (this.activeParticles >= this.maxParticles) return;
      const idx = this.activeParticles * 6;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      this.particles[idx + 0] = this.centerX + cos * dist;
      this.particles[idx + 1] = this.centerY + sin * dist;
      this.particles[idx + 2] = cos * speed;
      this.particles[idx + 3] = sin * speed;
      this.particles[idx + 4] = life;
      this.particles[idx + 5] = life;
      this.activeParticles++;
    }

    updateParticles(dt) {
      for (let i = 0; i < this.activeParticles; i++) {
        const idx = i * 6;
        this.particles[idx + 4] -= dt;
        if (this.particles[idx + 4] <= 0) {
          const lastIdx = (this.activeParticles - 1) * 6;
          for (let k = 0; k < 6; k++) {
            this.particles[idx + k] = this.particles[lastIdx + k];
          }
          this.activeParticles--;
          i--;
          continue;
        }
        this.particles[idx + 0] += this.particles[idx + 2] * dt;
        this.particles[idx + 1] += this.particles[idx + 3] * dt;
      }
    }

    updateRipples(dt) {
      for (let i = 0; i < this.maxRipples; i++) {
        const r = this.ripples[i];
        if (r.active) {
          r.radius += r.speed * dt * 60;
          r.opacity -= dt * 0.65;
          if (r.opacity <= 0 || r.radius > this.baseRadius * 1.85) {
            r.active = false;
          }
        }
      }
    }

    getThemeColors() {
      switch (this.state) {
        case 'listening':
          return {
            coreCenter: '#fffbf5',
            coreGlow: '#fed7aa',
            coreMid: '#f97316',
            coreEdge: '#c2410c',
            deepBase: '#7c2d12',
            aura: 'rgba(249, 115, 22, 0.42)',
            rim: 'rgba(255, 237, 213, 0.90)',
            rippleColor: 'rgba(251, 146, 60, 0.4)',
            glowSize: 1.95,
          };
        case 'speaking':
          return {
            coreCenter: '#ffffff',
            coreGlow: '#ffedd5',
            coreMid: '#fb923c',
            coreEdge: '#ea580c',
            deepBase: '#9a3412',
            aura: 'rgba(234, 88, 12, 0.55)',
            rim: 'rgba(255, 255, 255, 0.95)',
            rippleColor: 'rgba(249, 115, 22, 0.6)',
            glowSize: 2.15,
          };
        case 'searching':
          return {
            coreCenter: '#faf5ff',
            coreGlow: '#e9d5ff',
            coreMid: '#a855f7',
            coreEdge: '#7e22ce',
            deepBase: '#581c87',
            aura: 'rgba(168, 85, 247, 0.45)',
            rim: 'rgba(245, 208, 254, 0.85)',
            rippleColor: 'rgba(192, 132, 252, 0.45)',
            glowSize: 1.90,
          };
        case 'error':
          return {
            coreCenter: '#fef2f2',
            coreGlow: '#fecaca',
            coreMid: '#ef4444',
            coreEdge: '#b91c1c',
            deepBase: '#7f1d1d',
            aura: 'rgba(239, 68, 68, 0.42)',
            rim: 'rgba(254, 202, 202, 0.85)',
            rippleColor: 'rgba(248, 113, 113, 0.4)',
            glowSize: 1.80,
          };
        case 'idle':
        default:
          return {
            coreCenter: '#ffffff',
            coreGlow: '#f8fafc',
            coreMid: '#e2e8f0',
            coreEdge: '#94a3b8',
            deepBase: '#475569',
            aura: 'rgba(255, 255, 255, 0.12)',
            rim: 'rgba(255, 255, 255, 0.80)',
            rippleColor: 'rgba(255, 255, 255, 0.15)',
            glowSize: 1.60,
          };
      }
    }

    render(timestamp) {
      const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
      this.lastTimestamp = timestamp;

      // Smooth audio RMS response (fast rise, smooth decay)
      const smoothingFactor = this.rms > this.smoothRms ? 0.35 : 0.14;
      this.smoothRms = lerp(this.smoothRms, this.rms, smoothingFactor);

      // Trigger ripple and sparkles on strong voice spikes
      if (this.smoothRms > 0.18 && Math.random() < 0.28) {
        this.triggerRipple(2.2 + this.smoothRms * 2);
        const angle = Math.random() * Math.PI * 2;
        this.spawnParticle(angle, 25 + Math.random() * 35, this.baseRadius * 0.95, 0.6 + Math.random() * 0.4);
      }

      // Smooth cursor 3D depth tracking
      this.mouse.x = lerp(this.mouse.x, this.targetMouse.x, 0.08);
      this.mouse.y = lerp(this.mouse.y, this.targetMouse.y, 0.08);

      // Wave animation speed tied to voice activity
      const speedMultiplier = 1.0 + (this.smoothRms * 3.5);
      this.time += dt * speedMultiplier;

      this.updateParticles(dt);
      this.updateRipples(dt);

      // Clear frame
      this.ctx.clearRect(0, 0, this.width, this.height);

      const colors = this.getThemeColors();
      
      // Dynamic breathing radius
      const breathOffset = this.state === 'idle' ? Math.sin(this.time * 1.8) * 0.025 : 0;
      const currentRadius = this.baseRadius * (1 + this.smoothRms * 0.22 + breathOffset);

      // 3D light offset from cursor
      const lightOffsetX = this.centerX + (this.mouse.x * currentRadius * 0.22) - (currentRadius * 0.18);
      const lightOffsetY = this.centerY + (this.mouse.y * currentRadius * 0.22) - (currentRadius * 0.20);

      // -------------------------------------------------------------
      // 1. Cinematic Volumetric Atmospheric Aura (Backlight bloom)
      // -------------------------------------------------------------
      const auraRadius = currentRadius * (colors.glowSize + this.smoothRms * 0.35);
      const auraGrad = this.ctx.createRadialGradient(
        this.centerX, this.centerY, currentRadius * 0.35,
        this.centerX, this.centerY, auraRadius
      );
      auraGrad.addColorStop(0, colors.aura);
      auraGrad.addColorStop(0.55, colors.aura.replace(/[\d\.]+\)$/, '0.12)'));
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      this.ctx.save();
      this.ctx.fillStyle = auraGrad;
      this.ctx.beginPath();
      this.ctx.arc(this.centerX, this.centerY, auraRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();

      // -------------------------------------------------------------
      // 2. Acoustic Radiant Ripple Rings
      // -------------------------------------------------------------
      for (let i = 0; i < this.maxRipples; i++) {
        const r = this.ripples[i];
        if (r.active) {
          this.ctx.save();
          this.ctx.strokeStyle = colors.rippleColor.replace(/[\d\.]+\)$/, `${r.opacity * 0.75})`);
          this.ctx.lineWidth = 1.8;
          this.ctx.beginPath();
          this.ctx.arc(this.centerX, this.centerY, r.radius, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.restore();
        }
      }

      // -------------------------------------------------------------
      // 3. Fluid Organic Membrane (Cubic Bezier Spline)
      // -------------------------------------------------------------
      const segments = 48;
      const angleStep = (Math.PI * 2) / segments;
      const coords = [];

      let waveAmp1 = 0.02;
      let waveAmp2 = 0.012;
      let waveSpeed = 1.2;

      if (this.state === 'listening') {
        waveAmp1 = 0.035 + this.smoothRms * 0.14;
        waveAmp2 = 0.022 + this.smoothRms * 0.09;
        waveSpeed = 2.4;
      } else if (this.state === 'speaking') {
        waveAmp1 = 0.05 + this.smoothRms * 0.20;
        waveAmp2 = 0.035 + this.smoothRms * 0.12;
        waveSpeed = 3.6;
      } else if (this.state === 'searching') {
        waveAmp1 = 0.045;
        waveAmp2 = 0.03;
        waveSpeed = 3.0;
      }

      for (let i = 0; i <= segments; i++) {
        const theta = i * angleStep;
        const wave1 = Math.sin(theta * 3 + this.time * waveSpeed) * waveAmp1;
        const wave2 = Math.cos(theta * 5 - this.time * waveSpeed * 0.9) * waveAmp2;
        const wave3 = Math.sin(theta * 2 + this.time * 0.7) * 0.015;
        const r = currentRadius * (1 + wave1 + wave2 + wave3);

        coords.push({
          x: this.centerX + Math.cos(theta) * r,
          y: this.centerY + Math.sin(theta) * r
        });
      }

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.moveTo(coords[0].x, coords[0].y);

      // Smooth cardinal spline through fluid vertices
      for (let i = 0; i < segments; i++) {
        const p0 = coords[i === 0 ? segments - 1 : i - 1];
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const p3 = coords[(i + 2) > segments ? (i + 2) - segments : i + 2];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
      this.ctx.closePath();

      // Multi-stop Volumetric Fluid Gradient
      const coreGrad = this.ctx.createRadialGradient(
        lightOffsetX, lightOffsetY, currentRadius * 0.06,
        this.centerX, this.centerY, currentRadius * 1.05
      );
      coreGrad.addColorStop(0, colors.coreCenter);
      coreGrad.addColorStop(0.18, colors.coreGlow);
      coreGrad.addColorStop(0.50, colors.coreMid);
      coreGrad.addColorStop(0.82, colors.coreEdge);
      coreGrad.addColorStop(1, colors.deepBase);

      this.ctx.fillStyle = coreGrad;
      this.ctx.fill();

      // Delicate Glass Rim Light
      this.ctx.strokeStyle = colors.rim;
      this.ctx.lineWidth = 1.6;
      this.ctx.stroke();
      this.ctx.restore();

      // -------------------------------------------------------------
      // 4. Searching State: Orbital Stellar Ring
      // -------------------------------------------------------------
      if (this.state === 'searching') {
        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.rotate(this.time * 2.5);
        const orbitGrad = this.ctx.createLinearGradient(-currentRadius * 1.2, 0, currentRadius * 1.2, 0);
        orbitGrad.addColorStop(0, 'rgba(168, 85, 247, 0)');
        orbitGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
        orbitGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
        this.ctx.strokeStyle = orbitGrad;
        this.ctx.lineWidth = 2.4;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, currentRadius * 1.22, currentRadius * 0.45, Math.PI / 5, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
      }

      // -------------------------------------------------------------
      // 5. Specular Glint Highlight (3D Glass Caustic Depth)
      // -------------------------------------------------------------
      this.ctx.save();
      const glintX = lightOffsetX;
      const glintY = lightOffsetY;
      const glintRadius = currentRadius * 0.52;
      const glintGrad = this.ctx.createRadialGradient(
        glintX, glintY, 0,
        glintX, glintY, glintRadius
      );
      glintGrad.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
      glintGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.22)');
      glintGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      this.ctx.fillStyle = glintGrad;
      this.ctx.beginPath();
      this.ctx.arc(glintX, glintY, glintRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();

      // -------------------------------------------------------------
      // 6. Floating Acoustic Sparkles
      // -------------------------------------------------------------
      if (this.activeParticles > 0) {
        this.ctx.save();
        for (let i = 0; i < this.activeParticles; i++) {
          const idx = i * 6;
          const lifeFrac = this.particles[idx + 4] / this.particles[idx + 5];
          const alpha = lifeFrac * 0.85;
          this.ctx.fillStyle = `rgba(255, 237, 213, ${alpha})`;
          this.ctx.beginPath();
          this.ctx.arc(this.particles[idx + 0], this.particles[idx + 1], 1.8 * lifeFrac, 0, Math.PI * 2);
          this.ctx.fill();
        }
        this.ctx.restore();
      }

      this.rafId = requestAnimationFrame(this.render.bind(this));
    }

    destroy() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      window.removeEventListener('resize', this._onResize);
    }
  }

  window.OrbVisualizer = OrbVisualizer;
})(window);
