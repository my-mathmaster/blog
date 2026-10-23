/* A small, local canvas flourish. Pointer gestures never block the page beneath. */
(() => {
  'use strict';
  if (document.documentElement.dataset.fireworksBound) return;
  document.documentElement.dataset.fireworksBound = 'true';

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const colors = ['#238d9c', '#52b9c2', '#edb75d', '#e88c80', '#8a9fcb'];
  const maxParticles = 220;
  const particles = [];
  let canvas;
  let context;
  let frame = 0;
  let previousTime = 0;
  let gesture = null;
  let width = 0;
  let height = 0;

  const resize = () => {
    if (!canvas || !context) return;
    width = window.innerWidth;
    height = window.innerHeight;
    // Bound both high-DPI cost and the backing store on unusually large screens.
    const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(6000000 / Math.max(1, width * height)));
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const stop = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    particles.length = 0;
    gesture = null;
    if (context) context.clearRect(0, 0, width, height);
    if (canvas) {
      canvas.dataset.active = 'false';
      canvas.dataset.particles = '0';
    }
  };

  const prepare = () => {
    if (canvas) return !!context;
    canvas = document.createElement('canvas');
    canvas.id = 'click-fireworks';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.dataset.active = 'false';
    canvas.dataset.particles = '0';
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    context = canvas.getContext('2d');
    if (!context) return false;
    document.body.appendChild(canvas);
    resize();
    return true;
  };

  const draw = time => {
    frame = 0;
    if (document.hidden || motion.matches) return stop();
    const elapsed = previousTime ? Math.min(time - previousTime, 64) : 16;
    previousTime = time;
    context.clearRect(0, 0, width, height);
    for (let index = particles.length - 1; index >= 0; index--) {
      const particle = particles[index];
      particle.life -= elapsed;
      if (particle.life <= 0) {
        particles.splice(index, 1);
        continue;
      }
      const progress = 1 - particle.life / particle.duration;
      const seconds = elapsed / 1000;
      const oldX = particle.x;
      const oldY = particle.y;
      particle.x += particle.vx * seconds;
      particle.y += particle.vy * seconds;
      particle.vx *= Math.pow(0.97, elapsed / 16);
      particle.vy = particle.vy * Math.pow(0.97, elapsed / 16) + 65 * seconds;
      context.globalAlpha = Math.pow(1 - progress, 1.5);
      context.strokeStyle = particle.color;
      context.fillStyle = particle.color;
      if (particle.kind === 'ring') {
        context.lineWidth = 1.2;
        context.beginPath();
        context.arc(particle.x, particle.y, 4 + progress * 34, 0, Math.PI * 2);
        context.stroke();
      } else {
        // Fine rays give the burst a firework silhouette; dots add a softer layer.
        context.lineWidth = particle.radius * (1 - progress * 0.6);
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(oldX - particle.vx * 0.015, oldY - particle.vy * 0.015);
        context.lineTo(particle.x, particle.y);
        context.stroke();
        if (particle.kind === 'spark') {
          context.beginPath();
          context.arc(particle.x, particle.y, particle.radius * (1 - progress * 0.5), 0, Math.PI * 2);
          context.fill();
        }
      }
    }
    context.globalAlpha = 1;
    canvas.dataset.particles = String(particles.length);
    if (particles.length) frame = window.requestAnimationFrame(draw);
    else stop();
  };

  const burst = (x, y) => {
    if (motion.matches || document.hidden || !prepare()) return;
    const count = 34;
    if (particles.length + count + 1 > maxParticles) particles.splice(0, particles.length + count + 1 - maxParticles);
    const colorOffset = Math.floor(Math.random() * colors.length);
    for (let index = 0; index < count; index++) {
      const angle = Math.PI * 2 * index / count + Math.random() * 0.1;
      const speed = index % 3 === 0 ? 55 + Math.random() * 55 : 135 + Math.random() * 100;
      const duration = 550 + Math.random() * 450;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        duration, life: duration, radius: index % 3 === 0 ? 1.9 : 1.25,
        color: colors[(index + colorOffset) % colors.length],
        kind: index % 3 === 0 ? 'spark' : 'ray'
      });
    }
    particles.push({ x, y, vx: 0, vy: 0, duration: 380, life: 380, radius: 1, color: colors[colorOffset], kind: 'ring' });
    canvas.dataset.active = 'true';
    canvas.dataset.particles = String(particles.length);
    if (!frame) frame = window.requestAnimationFrame(draw);
  };

  document.addEventListener('pointerdown', event => {
    if (motion.matches || !event.isPrimary || event.button !== 0) {
      gesture = null;
      return;
    }
    gesture = {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      scrollX: window.scrollX, scrollY: window.scrollY, time: performance.now(),
      tolerance: event.pointerType === 'touch' ? 12 : 8, moved: false
    };
  }, { passive: true, capture: true });

  document.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > gesture.tolerance) gesture.moved = true;
  }, { passive: true, capture: true });

  document.addEventListener('pointerup', event => {
    const current = gesture;
    gesture = null;
    if (!current || event.pointerId !== current.id || current.moved || event.button !== 0) return;
    if (performance.now() - current.time > 700 || Math.hypot(event.clientX - current.x, event.clientY - current.y) > current.tolerance) return;
    if (window.scrollX !== current.scrollX || window.scrollY !== current.scrollY) return;
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    burst(event.clientX, event.clientY);
  }, { passive: true, capture: true });

  document.addEventListener('pointercancel', () => { gesture = null; }, { passive: true, capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('resize', resize, { passive: true });
  motion.addEventListener('change', () => { if (motion.matches) stop(); });
})();
