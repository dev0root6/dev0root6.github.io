// Squares in the empty space beside the content that pop up in 3D and sink
// back down, at random and near the pointer. Wide screens only (canvas hidden by CSS below 1100px).
(function () {
  const canvas = document.getElementById('squares');
  const content = document.querySelector('.wrap');
  if (!canvas || !content) return;
  const ctx = canvas.getContext('2d');
  const wide = matchMedia('(min-width: 1100px)');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CELL = 34, SIZE = 28, GAP = 40; // grid spacing, square size, clearance from content
  const HEIGHT = 12;                     // how far a square rises at full lift
  const POP = 1100;                      // ms for one rise-and-fall
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
        if (x + SIZE / 2 > left && x - SIZE / 2 < right) continue;
        cells.push({ x, y, start: -1e9, hover: 0, lift: 0 });
      }
    }
  }

  // Rise quickly, hold briefly, settle back down
  function popCurve(p) {
    if (p <= 0 || p >= 1) return 0;
    if (p < 0.25) return 1 - Math.pow(1 - p / 0.25, 3);
    if (p < 0.4) return 1;
    const q = (p - 0.4) / 0.6;
    return 1 - q * q * (3 - 2 * q);
  }

  function quad(points, alpha) {
    ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
    ctx.fill();
  }

  // A square seen from above; when lifted, its top moves up-left and the
  // right and bottom sides show, so it reads as a block rising off the page.
  function square(c) {
    const lift = c.lift, s = SIZE;
    const bx = c.x - s / 2, by = c.y - s / 2;
    const tx = bx - lift * HEIGHT * 0.6, ty = by - lift * HEIGHT;
    const top = 0.06 + lift * 0.8;
    if (lift > 0.02) {
      quad([[bx + s, by], [bx + s, by + s], [tx + s, ty + s], [tx + s, ty]], top * 0.45);
      quad([[bx, by + s], [bx + s, by + s], [tx + s, ty + s], [tx, ty + s]], top * 0.25);
    }
    quad([[tx, ty], [tx + s, ty], [tx + s, ty + s], [tx, ty + s]], top);
  }

  function draw(now) {
    ctx.clearRect(0, 0, w, h);
    const raised = [];
    cells.forEach(c => {
      const near = Math.max(0, 1 - Math.hypot(c.x - mx, c.y - my) / 130);
      c.hover += (near - c.hover) * 0.12;
      c.lift = Math.max(popCurve((now - c.start) / POP), c.hover);
      if (c.lift > 0.02) raised.push(c); else square(c);
    });
    // Raised squares last, lowest first, so neighbours never cover their sides
    raised.sort((a, b) => a.lift - b.lift).forEach(square);
  }

  let last = 0;
  function frame(now) {
    if (wide.matches) {
      if (now - last > 110 && cells.length) { // pop a few random squares
        last = now;
        for (let i = 0; i < 3; i++) {
          const c = cells[Math.floor(Math.random() * cells.length)];
          if (now - c.start > POP) c.start = now;
        }
      }
      draw(now);
    }
    requestAnimationFrame(frame);
  }

  addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  document.addEventListener('mouseleave', () => { mx = my = -1e4; });
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { build(); draw(performance.now()); }, 150); });
  build();
  if (still) draw(0); else requestAnimationFrame(frame);
})();
