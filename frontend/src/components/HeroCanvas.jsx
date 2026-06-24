import { useEffect, useRef } from 'react';

const PARTICLE_COUNT = 90;
const MAX_DIST       = 155;
const SPEED          = 0.32;
const DOT_RADIUS     = 1.8;
const COLOR          = '99,102,241';

// Floating wireframe shapes config
const SHAPES = [
  { type: 'triangle', x: 0.12, y: 0.25, size: 55, speed: 0.004, phase: 0 },
  { type: 'hex',      x: 0.88, y: 0.35, size: 45, speed: 0.005, phase: 1.2 },
  { type: 'triangle', x: 0.75, y: 0.72, size: 38, speed: 0.006, phase: 2.4 },
  { type: 'hex',      x: 0.22, y: 0.68, size: 50, speed: 0.003, phase: 0.8 },
  { type: 'diamond',  x: 0.50, y: 0.15, size: 32, speed: 0.007, phase: 1.8 },
  { type: 'diamond',  x: 0.92, y: 0.75, size: 28, speed: 0.005, phase: 3.0 },
];

function drawTriangle(ctx, cx, cy, size, angle, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.strokeStyle = `rgba(${COLOR},${alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * size;
    const y = Math.sin(a) * size;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHex(ctx, cx, cy, size, angle, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.strokeStyle = `rgba(${COLOR},${alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.cos(a) * size;
    const y = Math.sin(a) * size;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawDiamond(ctx, cx, cy, size, angle, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.strokeStyle = `rgba(${COLOR},${alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.6, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.6, 0);
  ctx.closePath();
  ctx.stroke();
  // inner smaller shape
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.5);
  ctx.lineTo(size * 0.3, 0);
  ctx.lineTo(0, size * 0.5);
  ctx.lineTo(-size * 0.3, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

export default function HeroCanvas() {
  const canvasRef = useRef(null);
  const mouse     = useRef({ x: -9999, y: -9999 });
  const rafRef    = useRef(null);
  const t         = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, particles;

    function resize() {
      w = canvas.width  = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }

    function makeParticle() {
      return {
        x:  Math.random() * w,
        y:  Math.random() * h,
        vx: (Math.random() - 0.5) * SPEED,
        vy: (Math.random() - 0.5) * SPEED,
      };
    }

    function init() {
      resize();
      particles = Array.from({ length: PARTICLE_COUNT }, makeParticle);
    }

    function draw() {
      t.current += 0.01;
      ctx.clearRect(0, 0, w, h);

      // ── Floating wireframe shapes ──
      for (const s of SHAPES) {
        const cx    = s.x * w;
        const cy    = s.y * h + Math.sin(t.current * 0.8 + s.phase) * 12;
        const angle = t.current * s.speed * 60 + s.phase;
        const pulse = 0.08 + Math.sin(t.current * 1.5 + s.phase) * 0.04;

        if (s.type === 'triangle') drawTriangle(ctx, cx, cy, s.size, angle, pulse);
        if (s.type === 'hex')      drawHex     (ctx, cx, cy, s.size, angle, pulse);
        if (s.type === 'diamond')  drawDiamond (ctx, cx, cy, s.size, angle, pulse);
      }

      // ── Particles ──
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      // mouse attract
      for (const p of particles) {
        const dx = mouse.current.x - p.x;
        const dy = mouse.current.y - p.y;
        const d  = Math.hypot(dx, dy);
        if (d < 200) { p.x += dx * 0.003; p.y += dy * 0.003; }
      }

      // connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx   = particles[i].x - particles[j].x;
          const dy   = particles[i].y - particles[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.32;
            ctx.strokeStyle = `rgba(${COLOR},${alpha})`;
            ctx.lineWidth   = 0.75;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // dots with glow
      for (const p of particles) {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, DOT_RADIUS * 5);
        grad.addColorStop(0, `rgba(${COLOR},0.5)`);
        grad.addColorStop(1, `rgba(${COLOR},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, DOT_RADIUS * 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${COLOR},0.9)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    init();
    draw();

    const onResize = () => { resize(); particles = Array.from({ length: PARTICLE_COUNT }, makeParticle); };
    const onMove   = (e) => { const r = canvas.getBoundingClientRect(); mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const onLeave  = ()  => { mouse.current = { x: -9999, y: -9999 }; };

    window.addEventListener('resize', onResize);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'auto', zIndex: 0, opacity: 0.6,
      }}
    />
  );
}
