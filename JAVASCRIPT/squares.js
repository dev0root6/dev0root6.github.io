// Small squares in the empty space beside the content that blink at random
// and light up near the pointer. Wide screens only (canvas hidden by CSS below 1100px).
(function () {
  const canvas = document.getElementById('squares');
  const content = document.querySelector('.wrap');
  if (!canvas || !content) return;
  const ctx = canvas.getContext('2d');
  const wide = matchMedia('(min-width: 1100px)');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CELL = 30, SIZE = 7, GAP = 48; // grid spacing, square size, clearance from content
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

  function draw() {
    ctx.clearRect(0, 0, w, h);
    cells.forEach(c => {
      const near = Math.max(0, 1 - Math.hypot(c.x - mx, c.y - my) / 110);
      const a = 0.07 + Math.max(c.glow, near) * 0.75;
      ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
      ctx.fillRect(c.x - SIZE / 2, c.y - SIZE / 2, SIZE, SIZE);
    });
  }

  let last = 0;
  function frame(t) {
    if (wide.matches) {
      if (t - last > 90) { // light a few random squares
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
