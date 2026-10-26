// Custom pointer: letters move out of the pointer's way, ring trails behind,
// links enlarge the ring and clicks send a ripple. Mouse devices only.
(function () {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const RADIUS = 70;   // how far around the pointer letters react
  const PUSH = 26;     // max distance a letter moves
  const root = document.querySelector('.wrap');

  // Split text into words (kept together for wrapping) and letters (moved individually)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const frag = document.createDocumentFragment();
    node.nodeValue.split(/(\s+)/).forEach(part => {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
      const word = document.createElement('span');
      word.className = 'wd';
      for (const c of part) {
        const ch = document.createElement('span');
        ch.className = 'ch';
        ch.textContent = c;
        word.appendChild(ch);
      }
      frag.appendChild(word);
    });
    node.parentNode.replaceChild(frag, node);
  });

  const style = document.createElement('style');
  style.textContent = 'a .wd,a .ch{text-decoration:inherit}';
  document.head.appendChild(style);

  // Cache letter centres in page coordinates, bucketed into a grid for fast lookup
  const letters = [...root.querySelectorAll('.ch')].map(el => ({ el, x: 0, y: 0, dx: 0, dy: 0 }));
  let grid = new Map();
  const key = (x, y) => Math.floor(x / RADIUS) + ',' + Math.floor(y / RADIUS);
  function measure() {
    grid = new Map();
    letters.forEach(l => {
      const r = l.el.getBoundingClientRect();
      l.x = r.left + r.width / 2 + scrollX - l.dx;
      l.y = r.top + r.height / 2 + scrollY - l.dy;
      const k = key(l.x, l.y);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(l);
    });
  }
  function near(px, py, radius) {
    const out = [], span = Math.ceil(radius / RADIUS);
    const bx = Math.floor(px / RADIUS), by = Math.floor(py / RADIUS);
    for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) {
      const cell = grid.get((bx + i) + ',' + (by + j));
      if (cell) out.push(...cell);
    }
    return out;
  }
  function move(l, dx, dy) {
    l.dx = dx; l.dy = dy;
    l.el.style.transform = dx || dy ? 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)' : '';
  }

  // Pointer elements
  const dot = document.createElement('div'); dot.className = 'cur-dot';
  const ring = document.createElement('div'); ring.className = 'cur-ring';
  document.body.append(dot, ring);
  document.documentElement.classList.add('has-pointer');

  let mx = -100, my = -100, rx = -100, ry = -100, inside = false, pending = false;
  let active = new Set();

  function repel() {
    pending = false;
    const next = new Set();
    if (inside) {
      const px = mx + scrollX, py = my + scrollY;
      near(px, py, RADIUS).forEach(l => {
        const vx = l.x - px, vy = l.y - py, d = Math.hypot(vx, vy);
        if (d >= RADIUS) return;
        const f = Math.pow(1 - d / RADIUS, 2) * PUSH;
        const a = d < 0.5 ? Math.random() * Math.PI * 2 : Math.atan2(vy, vx);
        move(l, Math.cos(a) * f, Math.sin(a) * f);
        next.add(l);
      });
    }
    active.forEach(l => { if (!next.has(l)) move(l, 0, 0); });
    active = next;
  }
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(repel); } };

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    if (!inside) { inside = true; rx = mx; ry = my; dot.style.opacity = ring.style.opacity = 1; }
    dot.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
    ring.classList.toggle('link', !!e.target.closest('a, button'));
    schedule();
  });
  document.addEventListener('mouseleave', () => {
    inside = false; dot.style.opacity = ring.style.opacity = 0; schedule();
  });
  addEventListener('scroll', schedule, { passive: true });

  // Ring eases toward the pointer
  (function follow() {
    rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
    ring.style.transform = 'translate(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px)';
    requestAnimationFrame(follow);
  })();

  document.addEventListener('mousedown', () => ring.classList.add('down'));
  document.addEventListener('mouseup', () => ring.classList.remove('down'));

  // Click: ripple plus a shockwave that pushes nearby letters out and lets them settle back
  document.addEventListener('click', e => {
    const rip = document.createElement('div');
    rip.className = 'cur-ripple';
    rip.style.left = e.clientX + 'px'; rip.style.top = e.clientY + 'px';
    rip.addEventListener('animationend', () => rip.remove());
    document.body.appendChild(rip);

    const px = e.clientX + scrollX, py = e.clientY + scrollY, R = RADIUS * 2.2;
    const hit = near(px, py, R).filter(l => Math.hypot(l.x - px, l.y - py) < R);
    hit.forEach(l => {
      const vx = l.x - px, vy = l.y - py, d = Math.hypot(vx, vy) || 1;
      const f = (1 - d / R) * PUSH * 1.4;
      move(l, vx / d * f, vy / d * f);
    });
    setTimeout(() => { hit.forEach(l => move(l, 0, 0)); active.clear(); schedule(); }, 220);
  });

  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(measure, 150); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(measure);
  addEventListener('load', measure);
})();
