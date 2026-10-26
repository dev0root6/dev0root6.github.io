// Small isometric cubes in the empty space beside the content that blink at random
// and light up near the pointer. Wide screens only (canvas hidden by CSS below 1100px).
(function () {
  const canvas = document.getElementById('squares');
  const content = document.querySelector('.wrap');
  if (!canvas || !content) return;
  const ctx = canvas.getContext('2d');
  const wide = matchMedia('(min-width: 1100px)');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CELL = 36, SIZE = 7, GAP = 48; // grid spacing, cube edge, clearance from content
  const K = Math.sqrt(3) / 2;
  let cells = [], w = 0, h = 0, mx = -1e4, my = -1e4;

  function build() {
    const dpr = devicePixelRatio || 1;
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = content.getBoundingClientRect();
    const left = r.left + 20 - GAP, right = r.right - 20 + GAP; // .wrap has 20px padding
    cells = [];
    for (let y = CELL / 2; y < h; y += CELL) {
      for (let x = CELL / 2; x < w; x += CELL) {
        if (x > left && x < right) continue;
        if (Math.random() > 0.45) continue; // sparse, uneven field
        cells.push({ x, y, glow: Math.random() * 0.3 });
      }
    }
  }

  function face(points, alpha) {
    ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
    ctx.fill();
  }
  // Top, left and right faces shaded light to dark so the cube reads as 3D
  function cube(x, y, a) {
    const s = SIZE, d = s * K;
    face([[x, y - s], [x + d, y - s / 2], [x, y], [x - d, y - s / 2]], a);
    face([[x - d, y - s / 2], [x, y], [x, y + s], [x - d, y + s / 2]], a * 0.55);
    face([[x, y], [x + d, y - s / 2], [x + d, y + s / 2], [x, y + s]], a * 0.28);
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    cells.forEach(c => {
      const near = Math.max(0, 1 - Math.hypot(c.x - mx, c.y - my) / 110);
      const a = 0.12 + Math.max(c.glow, near) * 0.85;
      cube(c.x, c.y, a);
    });
  }

  let last = 0;
  function frame(t) {
    if (wide.matches) {
      if (t - last > 90) { // light a few random cubes
        last = t;
        for (let i = 0; i < 3 && cells.length; i++) cells[Math.floor(Math.random() * cells.length)].glow = 1;
      }
      cells.forEach(c => { c.glow *= 0.94; });
      draw();
    }
    requestAnimationFrame(frame);
  }

  addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  document.addEventListener('mouseleave', () => { mx = my = -1e4; });
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { build(); draw(); }, 150); });
  build();
  if (still) draw(); else requestAnimationFrame(frame);
})();
