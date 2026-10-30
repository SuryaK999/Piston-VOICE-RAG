/**
 * Piston Voice RAG - High-Fidelity Canvas ORB Visualizer
 * Inspired by modern organic voice interfaces (ChatGPT / Gemini Live / Siri).
 * Features:
 *  - 60 FPS requestAnimationFrame loop with high-DPI retina scaling
 *  - Organic harmonic wave perimeter (Euler / multi-frequency sine synthesis)
 *  - Audio-reactive volumetric glow and acoustic ripple waves
 *  - Dynamic caustic specular light tracking mouse pointer with spring physics
 *  - Theme-aware (Light / Dark mode) calibrated color palette
 *  - Zero-allocation particle pool for acoustic sparkles
 */

(function (window) {
  'use strict';

  // Math & Interpolation utilities
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const lerp = (a, b, t) => a + (b - a) * t;

  class OrbVisualizer {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true });
      this.options = Object.assign({
        maxParticles: 32,
        baseDamping: 0.12,
      }, options);

      this.width = 0;
      this.height = 0;
      this.dpr = window.devicePixelRatio || 1;
      this.centerX = 0;
      this.centerY = 0;
      this.baseRadius = 100;

      // State
      this.state = 'idle'; // 'idle' | 'listening' | 'searching' | 'speaking' | 'error'
      this.targetState = 'idle';
      this.stateProgress = 1; // transition progress 0 -> 1

      // Audio RMS & reactivity
      this.rms = 0;
      this.smoothRms = 0;
      this.energy = 0;

      // Mouse tracking for 3D specular depth tilt
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
      const w = rect.width || 260;
      const h = rect.height || 260;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.width = w;
      this.height = h;
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(h * this.dpr);

      this.ctx.resetTransform();
      this.ctx.scale(this.dpr, this.dpr);

      this.centerX = w / 2;
      this.centerY = h / 2;
      this.baseRadius = Math.min(w, h) * 0.38;
    }

    setState(newState) {
      if (this.state === newState) return;
      this.targetState = newState;
      this.state = newState;
      this.stateProgress = 0;
    }

    setAudioLevel(rms) {
      this.rms = clamp(rms || 0, 0, 1);
    }

    isDarkMode() {
      return document.body.classList.contains('dark-mode');
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

    triggerRipple(speed = 1.8) {
      for (let i = 0; i < this.maxRipples; i++) {
        const r = this.ripples[i];
        if (!r.active) {
          r.active = true;
          r.radius = this.baseRadius * 0.95;
          r.opacity = 0.5;
          r.speed = speed;
          break;
        }
      }
    }

    updateParticles(dt) {
      for (let i = 0; i < this.activeParticles; i++) {
        const idx = i * 6;
        this.particles[idx + 4] -= dt; // life -= dt
        if (this.particles[idx + 4] <= 0) {
          // Swap with last active element
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
          r.opacity -= dt * 0.7;
          if (r.opacity <= 0 || r.radius > this.baseRadius * 1.6) {
            r.active = false;
          }
        }
      }
    }

    getThemeColors() {
      const dark = this.isDarkMode();
      switch (this.state) {
        case 'listening':
          return {
            coreCenter: '#ffedd5',
            coreMid: '#f97316',
            coreEdge: '#c2410c',
            aura: 'rgba(249, 115, 22, 0.35)',
            rim: 'rgba(254, 215, 170, 0.75)',
            glowSize: 1.45,
          };
        case 'speaking':
          return {
            coreCenter: '#fff7ed',
            coreMid: '#ea580c',
            coreEdge: '#9a3412',
            aura: 'rgba(234, 88, 12, 0.42)',
            rim: 'rgba(255, 237, 213, 0.85)',
            glowSize: 1.55,
          };
        case 'searching':
          return {
            coreCenter: '#fdf4ff',
            coreMid: '#c084fc',
            coreEdge: '#7e22ce',
            aura: 'rgba(192, 132, 252, 0.38)',
            rim: 'rgba(245, 208, 254, 0.75)',
            glowSize: 1.4,
          };
        case 'error':
          return {
            coreCenter: '#fef2f2',
            coreMid: '#ef4444',
            coreEdge: '#991b1b',
            aura: 'rgba(239, 68, 68, 0.32)',
            rim: 'rgba(254, 202, 202, 0.65)',
            glowSize: 1.35,
          };
        case 'idle':
        default:
          if (dark) {
            return {
              coreCenter: '#27272a',
              coreMid: '#18181b',
              coreEdge: '#09090b',
              aura: 'rgba(249, 115, 22, 0.12)',
              rim: 'rgba(250, 250, 250, 0.25)',
              glowSize: 1.25,
            };
          }
          return {
            coreCenter: '#ffffff',
            coreMid: '#f4f4f5',
            coreEdge: '#d4d4d8',
            aura: 'rgba(249, 115, 22, 0.08)',
            rim: 'rgba(255, 255, 255, 0.85)',
            glowSize: 1.25,
          };
      }
    }

    render(timestamp) {
      const dt = clamp((timestamp - this.lastTimestamp) / 1000, 0, 0.1);
      this.lastTimestamp = timestamp;
      this.time += dt;

      // Smooth mouse spring tracking
      this.mouse.x = lerp(this.mouse.x, this.targetMouse.x, dt * 8);
      this.mouse.y = lerp(this.mouse.y, this.targetMouse.y, dt * 8);

      // Smooth RMS tracking
      const targetRms = this.rms;
      this.smoothRms = lerp(this.smoothRms, targetRms, dt * 14);
      this.energy = lerp(this.energy, this.smoothRms * 1.5, dt * 6);

      // Periodic trigger of acoustic ripples
      if ((this.state === 'listening' || this.state === 'speaking') && this.smoothRms > 0.08) {
        if (Math.random() < this.smoothRms * 0.4) {
          this.triggerRipple(1.5 + this.smoothRms * 2);
        }
      }

      // Sparkle emission
      if (this.state === 'speaking' && this.smoothRms > 0.05) {
        if (Math.random() < 0.25) {
          const angle = Math.random() * Math.PI * 2;
          this.spawnParticle(angle, 15 + Math.random() * 30, this.baseRadius * 0.9, 0.6 + Math.random() * 0.4);
        }
      }

      this.updateParticles(dt);
      this.updateRipples(dt);

      // Clear frame
      this.ctx.clearRect(0, 0, this.width, this.height);

      const colors = this.getThemeColors();
      const currentRadius = this.baseRadius * (1 + this.smoothRms * 0.28 + (this.state === 'idle' ? Math.sin(this.time * 1.5) * 0.02 : 0));

      // Specular light displacement (3D tilt + breathing)
      const lightOffsetX = this.centerX + this.mouse.x * (this.baseRadius * 0.25) - this.baseRadius * 0.2;
      const lightOffsetY = this.centerY + this.mouse.y * (this.baseRadius * 0.25) - this.baseRadius * 0.2;

      // 1. Layer 1: Ambient Volumetric Aura Glow
      const auraRadius = currentRadius * (colors.glowSize + this.smoothRms * 0.35);
      const auraGrad = this.ctx.createRadialGradient(this.centerX, this.centerY, currentRadius * 0.5, this.centerX, this.centerY, auraRadius);
      auraGrad.addColorStop(0, colors.aura);
      auraGrad.addColorStop(0.7, colors.aura.replace(/[\d\.]+\)$/, '0.1)'));
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      this.ctx.fillStyle = auraGrad;
      this.ctx.beginPath();
      this.ctx.arc(this.centerX, this.centerY, auraRadius, 0, Math.PI * 2);
      this.ctx.fill();

      // 2. Layer 2: Acoustic Ripple Waves
      for (let i = 0; i < this.maxRipples; i++) {
        const r = this.ripples[i];
        if (r.active) {
          this.ctx.save();
          this.ctx.strokeStyle = colors.aura.replace(/[\d\.]+\)$/, `${r.opacity * 0.6})`);
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.arc(this.centerX, this.centerY, r.radius, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.restore();
        }
      }

      // 3. Layer 3: Organic Harmonic Wave Membrane
      this.ctx.save();
      this.ctx.beginPath();
      const segments = 64;
      const angleStep = (Math.PI * 2) / segments;
      
      // Distortion amplitudes based on state and RMS
      let waveAmp1 = 0.02;
      let waveAmp2 = 0.015;
      let waveSpeed = 1.0;

      if (this.state === 'listening') {
        waveAmp1 = 0.03 + this.smoothRms * 0.12;
        waveAmp2 = 0.02 + this.smoothRms * 0.08;
        waveSpeed = 2.5;
      } else if (this.state === 'speaking') {
        waveAmp1 = 0.04 + this.smoothRms * 0.16;
        waveAmp2 = 0.03 + this.smoothRms * 0.10;
        waveSpeed = 3.5;
      } else if (this.state === 'searching') {
        waveAmp1 = 0.05;
        waveAmp2 = 0.03;
        waveSpeed = 4.0;
      }

      for (let i = 0; i <= segments; i++) {
        const theta = i * angleStep;
        const wave1 = Math.sin(theta * 3 + this.time * waveSpeed) * waveAmp1;
        const wave2 = Math.cos(theta * 5 - this.time * waveSpeed * 1.3) * waveAmp2;
        const wave3 = Math.sin(theta * 2 + this.time * 0.8) * 0.015;
        const r = currentRadius * (1 + wave1 + wave2 + wave3);

        const x = this.centerX + Math.cos(theta) * r;
        const y = this.centerY + Math.sin(theta) * r;
        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      this.ctx.closePath();

      // Volumetric Core Gradient
      const coreGrad = this.ctx.createRadialGradient(
        lightOffsetX, lightOffsetY, currentRadius * 0.08,
        this.centerX, this.centerY, currentRadius
      );
      coreGrad.addColorStop(0, colors.coreCenter);
      coreGrad.addColorStop(0.45, colors.coreMid);
      coreGrad.addColorStop(1, colors.coreEdge);

      this.ctx.fillStyle = coreGrad;
      this.ctx.fill();

      // Rim Fresnel Highlight
      this.ctx.strokeStyle = colors.rim;
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();
      this.ctx.restore();

      // 4. Layer 4: Orbital Tracer Beams (When Searching)
      if (this.state === 'searching') {
        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.rotate(this.time * 3);
        const orbitGrad = this.ctx.createLinearGradient(-currentRadius, 0, currentRadius, 0);
        orbitGrad.addColorStop(0, 'rgba(192, 132, 252, 0)');
        orbitGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
        orbitGrad.addColorStop(1, 'rgba(192, 132, 252, 0)');
        this.ctx.strokeStyle = orbitGrad;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, currentRadius * 1.15, currentRadius * 0.45, Math.PI / 6, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
      }

      // 5. Layer 5: Specular Caustic Glint
      this.ctx.save();
      const glintGrad = this.ctx.createRadialGradient(
        lightOffsetX, lightOffsetY, 0,
        lightOffsetX, lightOffsetY, currentRadius * 0.45
      );
      glintGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      glintGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.2)');
      glintGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = glintGrad;
      this.ctx.beginPath();
      this.ctx.arc(lightOffsetX, lightOffsetY, currentRadius * 0.45, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();

      // 6. Layer 6: Acoustic Particle Sparks
      if (this.activeParticles > 0) {
        this.ctx.save();
        for (let i = 0; i < this.activeParticles; i++) {
          const idx = i * 6;
          const lifeFrac = this.particles[idx + 4] / this.particles[idx + 5];
          const alpha = lifeFrac * 0.85;
          this.ctx.fillStyle = `rgba(254, 215, 170, ${alpha})`;
          this.ctx.beginPath();
          this.ctx.arc(this.particles[idx + 0], this.particles[idx + 1], 2 * lifeFrac, 0, Math.PI * 2);
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
