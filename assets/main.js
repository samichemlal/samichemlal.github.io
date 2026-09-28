// ---------- Tabs (hash routing) ----------
const views = [...document.querySelectorAll('.view')];
const tabs = [...document.querySelectorAll('.tabs a')];

function show() {
  const id = location.hash.slice(1) || 'about';
  const target = views.find(v => v.id === id) || views[0];
  views.forEach(v => v.classList.toggle('active', v === target));
  tabs.forEach(a => a.getAttribute('href') === '#' + target.id
    ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  window.scrollTo(0, 0);
  if (target.id === 'about') drawSketch();
}
window.addEventListener('hashchange', show);

// ---------- Links not filled in yet (href="TODO") ----------
document.querySelectorAll('a[href="TODO"]').forEach(a => {
  const s = document.createElement('span');
  s.className = 'btn soon';
  s.innerHTML = a.innerHTML;
  s.lastChild.textContent = a.dataset.soon || 'soon';
  a.replaceWith(s);
});

// ---------- Line portrait animation ----------
const card = document.getElementById('sketch');
let drawn = false;
function drawSketch(force) {
  if (!card || (drawn && !force)) return;
  drawn = true;
  const paths = [...card.querySelectorAll('path')];
  let t = 0.2;
  paths.forEach(p => {
    // duration grows with stroke length so long curls are drawn slower
    const len = +p.dataset.len || 100;
    const dur = Math.min(1.1, 0.3 + len / 600);
    p.style.setProperty('--delay', t + 's');
    p.style.setProperty('--dur', dur + 's');
    t += dur * 0.28;
  });
  card.classList.remove('drawing', 'done');
  void card.offsetWidth; // restart CSS animations
  card.classList.add('drawing');
}
document.getElementById('replay')?.addEventListener('click', () => drawSketch(true));

// ---------- Lightbox ----------
const lb = document.getElementById('lightbox');
document.querySelectorAll('.shot img').forEach(img =>
  img.addEventListener('click', () => { lb.querySelector('img').src = img.src; lb.querySelector('img').alt = img.alt; lb.classList.add('open'); }));
lb.addEventListener('click', () => lb.classList.remove('open'));
document.addEventListener('keydown', e => e.key === 'Escape' && lb.classList.remove('open'));

// ---------- Theme toggle ----------
const root = document.documentElement;
try { const t = localStorage.getItem('theme'); if (t) root.dataset.theme = t; } catch (e) {}
document.getElementById('theme').addEventListener('click', () => {
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
});

show();
