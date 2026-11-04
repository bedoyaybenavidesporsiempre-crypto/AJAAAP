import { useEffect, useRef } from 'react';
import particleSvg from '@/assets/aja_particles.svg';

type Particle = {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  opacityPhase: number;
  opacitySpeed: number;
};

const MAX_PARTICLES = 30;
const MOBILE_PARTICLE_LIMIT = 15;
const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT}px), (hover: none) and (pointer: coarse)`;

function getParticleCount(width: number) {
  return width <= MOBILE_BREAKPOINT ? MOBILE_PARTICLE_LIMIT : MAX_PARTICLES;
}

export function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = particleSvg;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const isMobile = window.matchMedia(MOBILE_QUERY).matches;

    let particles: Particle[] = [];
    let width = window.innerWidth;
    let height = window.innerHeight;
    let rafId = 0;

    const initParticles = () => {
      const count = getParticleCount(width);
      particles = [];
      for (let i = 0; i < count; i++) {
        const size = 36 + Math.random() * 46;
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.004,
          opacity: 0.5 + Math.random() * 0.3,
          opacityPhase: Math.random() * Math.PI * 2,
          opacitySpeed: 0.003 + Math.random() * 0.005,
        });
      }
    };

    const moveParticles = () => {
      const margin = 80;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacityPhase += p.opacitySpeed;

        // Wrap around edges for continuous fluid motion
        if (p.x < -margin) p.x = width + margin;
        if (p.x > width + margin) p.x = -margin;
        if (p.y < -margin) p.y = height + margin;
        if (p.y > height + margin) p.y = -margin;
      }
    };

    const paint = () => {
      ctx.clearRect(0, 0, width, height);
      if (!img.complete || img.naturalWidth <= 0) return;

      const aspect = img.naturalHeight / img.naturalWidth;
      for (const p of particles) {
        const breath = 0.7 + 0.3 * Math.sin(p.opacityPhase);
        const drawW = p.size;
        const drawH = p.size * aspect;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity * breath;
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      }
    };

    const animate = () => {
      moveParticles();
      paint();
      rafId = requestAnimationFrame(animate);
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
      if (isMobile) paint();
    };

    const start = () => {
      if (isMobile) paint();
      else rafId = requestAnimationFrame(animate);
    };

    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    resize();

    if (img.complete) {
      start();
    } else {
      img.onload = start;
    }

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafId);
      img.onload = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -9999,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}
