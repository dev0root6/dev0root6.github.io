// Shared behaviour: window open animation, taskbar, start menu, clocks
(function () {
  // Windows animate open as they scroll into view
  const pops = document.querySelectorAll('.pop');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        e.target.querySelectorAll('.pb i[data-w]').forEach(i => { i.style.width = i.dataset.w + '%'; });
        io.unobserve(e.target);
      });
    }, { threshold: 0.12 });
    pops.forEach(p => io.observe(p));
  } else {
    pops.forEach(p => p.classList.add('in'));
  }

  // Highlight the taskbar button of the window in view
  const tasks = [...document.querySelectorAll('.task[href^="#"]')];
  if (tasks.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        tasks.forEach(t => t.classList.toggle('on', t.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    tasks.forEach(t => { const w = document.querySelector(t.getAttribute('href')); if (w) spy.observe(w); });
  }

  // Start menu
  const orb = document.querySelector('.orb');
  const start = document.querySelector('.start');
  if (orb && start) {
    const toggle = on => { start.classList.toggle('on', on); orb.classList.toggle('on', on); orb.setAttribute('aria-expanded', on); };
    orb.addEventListener('click', e => { e.stopPropagation(); toggle(!start.classList.contains('on')); });
    document.addEventListener('click', e => { if (!start.contains(e.target)) toggle(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });
    start.querySelectorAll('a').forEach(a => a.addEventListener('click', () => toggle(false)));
  }

  // Tray clock and analog clock gadget
  const tray = document.querySelector('.tray');
  const clock = document.querySelector('.clock');
  if (clock) {
    for (let i = 0; i < 12; i++) {
      const u = document.createElement('u');
      u.style.transform = 'rotate(' + i * 30 + 'deg)';
      clock.appendChild(u);
    }
  }
  function tick() {
    const d = new Date();
    if (tray) {
      tray.innerHTML = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) +
        '<br>' + d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (clock) {
      const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
      clock.querySelector('.h').style.transform = 'rotate(' + h * 30 + 'deg)';
      clock.querySelector('.m').style.transform = 'rotate(' + m * 6 + 'deg)';
      clock.querySelector('.s').style.transform = 'rotate(' + s * 6 + 'deg)';
    }
  }
  tick();
  setInterval(tick, 1000);
})();
