// Publication animations: MTL-CMO, DOODL (concept animations) and the real plasma snapshots.
// Scenes are pure functions of the clock t (plus a particle state for the Langevin systems),
// so a paused or finished animation is just a still frame. Data lives in assets/viz-data.js.
(() => {
  const D = window.VIZ_DATA;
  if (!D) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- helpers ----------
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const ease = x => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = r => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

  function theme() {
    const s = getComputedStyle(document.documentElement);
    const v = n => s.getPropertyValue(n).trim();
    return {
      ink: v('--ink'), muted: v('--muted'), line: v('--line'), surface: v('--surface'), bg: v('--bg'),
      series: [v('--s1'), v('--s2'), v('--s3')],
      sans: 'Inter, system-ui, sans-serif', serif: '"Source Serif 4", Georgia, serif',
    };
  }

  function text(c, str, x, y, { size = 13, color, font = 'sans', align = 'left', base = 'alphabetic', weight = 400, italic = false, th }) {
    c.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font === 'serif' ? th.serif : th.sans}`;
    c.fillStyle = color || th.ink;
    c.textAlign = align;
    c.textBaseline = base;
    c.fillText(str, x, y);
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function dot(c, x, y, r, fill, ring, ringW = 2) {
    c.beginPath();
    c.arc(x, y, r + (ring ? ringW : 0), 0, 2 * Math.PI);
    if (ring) { c.fillStyle = ring; c.fill(); c.beginPath(); c.arc(x, y, r, 0, 2 * Math.PI); }
    c.fillStyle = fill;
    c.fill();
  }

  // Draw the first fraction p of a polyline.
  function partialLine(c, pts, p) {
    if (p <= 0 || pts.length < 2) return;
    const n = (pts.length - 1) * clamp(p);
    const k = Math.floor(n);
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= k; i++) c.lineTo(pts[i][0], pts[i][1]);
    if (k < pts.length - 1) {
      const f = n - k, a = pts[k], b = pts[k + 1];
      c.lineTo(lerp(a[0], b[0], f), lerp(a[1], b[1], f));
    }
    c.stroke();
  }

  const bezier = (p0, p1, p2, p3, n = 40) => Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, s = 1 - t;
    return [0, 1].map(j => s * s * s * p0[j] + 3 * s * s * t * p1[j] + 3 * s * t * t * p2[j] + t * t * t * p3[j]);
  });

  // ---------- player: clock, visibility, controls, resize ----------
  const players = [];

  class Player {
    constructor(fig, scene) {
      this.fig = fig;
      this.scene = scene;
      this.canvas = fig.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.cap = fig.querySelector('.viz-caption');
      this.btn = fig.querySelector('.viz-btn');
      this.t = 0;
      this.playing = false;
      this.visible = false;
      this.started = false;
      this.raf = null;
      this.btn.addEventListener('click', () => (this.playing ? this.pause() : this.play()));
      new ResizeObserver(() => { this.resize(); this.draw(); }).observe(this.canvas.parentElement);
      new IntersectionObserver(([e]) => {
        this.visible = e.isIntersecting;
        if (!this.visible) return;
        if (!this.started) {
          this.started = true;
          if (reduce) { this.t = scene.duration; this.draw(); this.setBtn(); } else this.play();
        } else this.kick();
      }, { threshold: 0.3 }).observe(fig);
      players.push(this);
      this.resize();
      this.setBtn();
    }
    resize() {
      const w = this.canvas.parentElement.clientWidth;
      if (!w) return;
      const L = w >= 640 ? this.scene.wide : this.scene.narrow;
      this.layout = L;
      this.scale = w / L.w;
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.style.height = `${L.h * this.scale}px`;
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(L.h * this.scale * this.dpr);
    }
    draw() {
      if (!this.layout) return;
      const c = this.ctx;
      c.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
      c.clearRect(0, 0, this.layout.w, this.layout.h);
      this.scene.draw(c, this.t, this.layout, theme());
      let caption = this.scene.steps[0][1];
      for (const [t0, s] of this.scene.steps) if (this.t >= t0) caption = s;
      if (this.cap.textContent !== caption) this.cap.textContent = caption;
      this.cap.classList.toggle('final', this.t >= this.scene.steps[this.scene.steps.length - 1][0]);
    }
    play() {
      if (this.t >= this.scene.duration) { this.t = 0; this.scene.reset?.(); }
      this.playing = true;
      this.setBtn();
      this.kick();
    }
    pause() { this.playing = false; this.setBtn(); }
    setBtn() {
      this.btn.textContent = this.playing ? '❚❚ Pause' : this.t >= this.scene.duration ? '↺ Replay' : '▶ Play';
    }
    kick() {
      if (this.raf || !this.playing || !this.visible) return;
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
    frame = now => {
      this.raf = null;
      if (!this.playing || !this.visible) return; // stops computing off screen or when paused
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t = Math.min(this.scene.duration, this.t + dt);
      this.scene.update?.(dt, this.t);
      this.draw();
      if (this.t >= this.scene.duration) { this.playing = false; this.setBtn(); return; }
      this.raf = requestAnimationFrame(this.frame);
    };
  }

  // ---------- MTL-CMO: many dynamics, shared spaces ----------
  function mtlScene(M) {
    const V = (s, x) => s.a * (x * x - 1) ** 2 + s.b * x;
    const dV = (s, x) => 4 * s.a * x * (x * x - 1) + s.b;
    const XR = 1.65;

    // Overdamped Langevin particles: an illustration of each system, not model output.
    class Swarm {
      constructor(sys, n, seed) { this.sys = sys; this.n = n; this.seed = seed; this.reset(); }
      reset() {
        this.r = rng(this.seed);
        this.x = Array.from({ length: this.n }, (_, i) => (i % 2 ? 1 : -1) * (0.75 + 0.4 * this.r()));
      }
      step(dt) {
        const h = 0.004, s = this.sys, amp = Math.sqrt((2 * h) / s.beta);
        for (let k = 0; k < Math.ceil((dt * 1.6) / h); k++)
          this.x = this.x.map(x => {
            let y = x - dV(s, x) * h + amp * gauss(this.r);
            if (y > XR) y = 2 * XR - y;
            if (y < -XR) y = -2 * XR - y;
            return y;
          });
      }
    }
    const swarms = M.systems.map((s, k) => new Swarm(s, 7, 11 + 17 * k));
    const newSwarm = new Swarm(M.newSystem, 7, 99);

    function potentialPanel(c, box, sys, swarm, color, alpha, th, label) {
      c.save();
      c.globalAlpha = alpha;
      roundRect(c, box.x, box.y, box.w, box.h, 10);
      c.fillStyle = th.surface; c.fill();
      c.strokeStyle = th.line; c.lineWidth = 1; c.stroke();
      const vs = Array.from({ length: 61 }, (_, i) => V(sys, -XR + (2 * XR * i) / 60));
      const lo = Math.min(...vs), hi = Math.max(...vs);
      const px = x => box.x + 10 + ((x + XR) / (2 * XR)) * (box.w - 20);
      const py = v => box.y + box.h - 10 - ((v - lo) / (hi - lo)) * (box.h - 30);
      c.strokeStyle = color; c.lineWidth = 2; c.lineJoin = 'round';
      c.beginPath();
      vs.forEach((v, i) => { const x = -XR + (2 * XR * i) / 60; i ? c.lineTo(px(x), py(v)) : c.moveTo(px(x), py(v)); });
      c.stroke();
      for (const x of swarm.x) dot(c, px(x), py(V(sys, x)) - 4.5, 3.2, color, th.surface, 1.5);
      if (label) text(c, label, box.x + 10, box.y + 16, { size: 11.5, color: th.muted, th });
      c.restore();
    }

    function spaceBox(c, box, sym, th, appear, frozen) {
      if (appear <= 0) return;
      c.save();
      c.globalAlpha = appear;
      roundRect(c, box.x, box.y, box.w, box.h, 12);
      c.fillStyle = th.surface; c.fill();
      c.lineWidth = frozen > 0 ? 1.5 : 1;
      c.strokeStyle = frozen > 0 ? th.ink : th.line;
      c.setLineDash(frozen > 0 ? [5, 4] : []);
      c.stroke();
      c.setLineDash([]);
      // basis functions sym_1 ... sym_d as small glyphs
      const d = 6, gw = box.w - 18, gh = (box.h - 24) / d;
      for (let j = 0; j < d; j++) {
        const cy = box.y + 12 + gh * (j + 0.5);
        c.strokeStyle = th.muted; c.lineWidth = 1.2;
        c.beginPath();
        for (let i = 0; i <= 30; i++) {
          const u = -1 + (2 * i) / 30;
          const f = sym === 'φ' ? Math.sin((j + 1) * 1.4 * (u + 1)) * Math.exp(-u * u) : Math.cos((j + 1) * 1.3 * u) * (1 - 0.5 * u * u);
          const x = box.x + 9 + ((u + 1) / 2) * gw, y = cy - f * gh * 0.32;
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        c.stroke();
      }
      text(c, sym, box.x + box.w / 2, box.y - 10, { size: 24, font: 'serif', italic: true, align: 'center', th });
      if (frozen > 0) {
        c.globalAlpha = appear * frozen;
        const lx = box.x + box.w / 2, ly = box.y + box.h + 18;
        // lock glyph
        c.strokeStyle = th.ink; c.lineWidth = 1.4;
        c.beginPath(); c.arc(lx - 26, ly - 8, 3.4, Math.PI, 0); c.stroke();
        roundRect(c, lx - 31, ly - 8, 10, 8, 1.5); c.fillStyle = th.ink; c.fill();
        text(c, 'Frozen', lx + 5, ly, { size: 12.5, weight: 600, align: 'center', th });
      }
      c.restore();
    }

    function matrix(c, cx, cy, cell, A, color, prog, alpha) {
      const n = A.length, gap = 2, size = n * cell + (n - 1) * gap;
      const x0 = cx - size / 2, y0 = cy - size / 2;
      c.save();
      c.globalAlpha = alpha;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const k = (i * n + j) / (n * n);
          if (prog <= k) continue;
          const a = clamp((prog - k) * n * n);
          c.globalAlpha = alpha * a * (0.14 + 0.86 * Math.abs(A[i][j]));
          roundRect(c, x0 + j * (cell + gap), y0 + i * (cell + gap), cell, cell, 2.5);
          c.fillStyle = color; c.fill();
        }
      c.restore();
      return size;
    }

    const mix = (p, y) => p.weights.reduce((s, w, i) => s + (w * Math.exp(-0.5 * ((y - p.means[i]) / p.sds[i]) ** 2)) / (p.sds[i] * Math.sqrt(2 * Math.PI)), 0);

    function densityPanel(c, B, t, th) {
      const pIn = seg(t, 12.6, 14.4);
      if (pIn <= 0) return;
      const { y: [ya, yb], reference, estimate } = M.density;
      const ys = Array.from({ length: 121 }, (_, i) => ya + ((yb - ya) * i) / 120);
      const pr = ys.map(y => mix(reference, y)), pe = ys.map(y => mix(estimate, y));
      const top = Math.max(...pr, ...pe) * 1.1;
      const X = y => B.x + ((y - ya) / (yb - ya)) * B.w, Y = p => B.y + B.h - (p / top) * B.h;
      c.save();
      c.globalAlpha = seg(t, 12.6, 13.1);
      text(c, 'p(y | x), new system', B.x, B.y - 12, { size: 13, weight: 600, th });
      c.strokeStyle = th.line; c.lineWidth = 1;
      c.beginPath(); c.moveTo(B.x, B.y + B.h); c.lineTo(B.x + B.w, B.y + B.h); c.stroke();
      text(c, 'y', B.x + B.w, B.y + B.h + 16, { size: 12, color: th.muted, align: 'right', italic: true, font: 'serif', th });
      c.lineWidth = 1.6; c.strokeStyle = th.muted; c.setLineDash([5, 4]);
      partialLine(c, ys.map((y, i) => [X(y), Y(pr[i])]), seg(t, 12.7, 13.8));
      c.setLineDash([]);
      c.lineWidth = 2.2; c.strokeStyle = th.ink;
      partialLine(c, ys.map((y, i) => [X(y), Y(pe[i])]), seg(t, 13.2, 14.4));
      // legend
      const ly = B.y + B.h + 36;
      c.lineWidth = 2.2; c.strokeStyle = th.ink;
      c.beginPath(); c.moveTo(B.x, ly - 4); c.lineTo(B.x + 22, ly - 4); c.stroke();
      text(c, 'estimate', B.x + 28, ly, { size: 12, color: th.muted, th });
      c.lineWidth = 1.6; c.strokeStyle = th.muted; c.setLineDash([5, 4]);
      c.beginPath(); c.moveTo(B.x + 100, ly - 4); c.lineTo(B.x + 122, ly - 4); c.stroke();
      c.setLineDash([]);
      text(c, 'reference', B.x + 128, ly, { size: 12, color: th.muted, th });
      c.restore();
    }

    const wide = {
      w: 900, h: 400, wideLayout: true,
      sys: [34, 158, 282].map(y => ({ x: 12, y, w: 210, h: 84 })),
      phi: { x: 320, y: 58, w: 74, h: 296 },
      psi: { x: 580, y: 58, w: 74, h: 296 },
      mat: { cx: 487, cy: [76, 200, 324], cell: 14 },
      dens: { x: 706, y: 110, w: 176, h: 170 },
    };
    const narrow = {
      w: 380, h: 700, wideLayout: false,
      sys: [0, 1, 2].map(i => ({ x: 6 + i * 125, y: 30, w: 118, h: 74 })),
      phi: { x: 16, y: 176, w: 62, h: 262 },
      psi: { x: 302, y: 176, w: 62, h: 262 },
      mat: { cx: 190, cy: [224, 307, 390], cell: 12 },
      dens: { x: 44, y: 540, w: 300, h: 100 },
    };

    return {
      duration: 16.5,
      wide, narrow,
      steps: [
        [0, 'Several Langevin systems, one colour each.'],
        [1.4, 'Shared function spaces φ and ψ, learned jointly across all tasks.'],
        [4.2, 'Each task keeps its own small matrix between the shared spaces.'],
        [8, 'A new system arrives. The shared spaces are frozen.'],
        [10.2, 'A few observations of the new system give its matrix M* in closed form.'],
        [12.6, 'The new operator gives conditional statistics, e.g. the density p(y | x).'],
        [14.6, 'New system. Same learned spaces. Closed-form adaptation.'],
      ],
      reset() { swarms.forEach(s => s.reset()); newSwarm.reset(); },
      update(dt, t) {
        swarms.forEach(s => s.step(dt));
        if (t > 8.6) newSwarm.step(dt);
      },
      draw(c, t, L, th) {
        const dim = 1 - 0.82 * seg(t, 8, 9);
        const frozen = seg(t, 9.4, 10.2);
        const newIn = ease(seg(t, 8.6, 9.6));
        const phi = L.phi, psi = L.psi;
        const entry = k => (L.wideLayout ? [phi.x, L.mat.cy[k]] : [phi.x + phi.w / 2, phi.y - 30]);
        const sysExit = b => (L.wideLayout ? [b.x + b.w, b.y + b.h / 2] : [b.x + b.w / 2, b.y + b.h]);
        const flowPath = (b, k) => {
          const a = sysExit(b), e = entry(k);
          return L.wideLayout
            ? bezier(a, [a[0] + 50, a[1]], [e[0] - 50, e[1]], e)
            : bezier(a, [a[0], a[1] + 30], [e[0], e[1] - 30], e);
        };

        text(c, 'Langevin systems', L.sys[0].x + 2, L.sys[0].y - 12, { size: 12, color: th.muted, weight: 600, th });

        // flows: system -> phi -> matrix -> psi
        L.sys.forEach((b, k) => {
          const col = th.series[k];
          c.save();
          c.globalAlpha = dim * 0.75;
          c.strokeStyle = col; c.lineWidth = 1.4;
          partialLine(c, flowPath(b, k), seg(t, 2.6 + 0.3 * k, 3.6 + 0.3 * k));
          const y = L.mat.cy[k], half = (4 * L.mat.cell + 6) / 2;
          c.globalAlpha = dim * 0.75 * seg(t, 4.2 + 0.6 * k, 4.6 + 0.6 * k);
          c.beginPath();
          c.moveTo(phi.x + phi.w, y); c.lineTo(L.mat.cx - half - 8, y);
          c.moveTo(L.mat.cx + half + 8, y); c.lineTo(psi.x, y);
          c.stroke();
          c.restore();
        });

        L.sys.forEach((b, k) =>
          potentialPanel(c, b, M.systems[k], swarms[k], th.series[k], seg(t, 0.2 * k, 1 + 0.2 * k) * dim, th, `task ${k + 1}`));

        spaceBox(c, phi, 'φ', th, ease(seg(t, 1.4, 2.4)), frozen);
        spaceBox(c, psi, 'ψ', th, ease(seg(t, 1.8, 2.8)), frozen);
        if (L.wideLayout) {
          c.save();
          c.globalAlpha = seg(t, 2, 3);
          text(c, 'shared spaces', (phi.x + psi.x + psi.w) / 2, 18, { size: 12, color: th.muted, weight: 600, align: 'center', th });
          c.strokeStyle = th.line; c.lineWidth = 1;
          c.beginPath();
          c.moveTo(phi.x + phi.w / 2, 30); c.lineTo(phi.x + phi.w / 2, 24); c.lineTo(psi.x + psi.w / 2, 24); c.lineTo(psi.x + psi.w / 2, 30);
          c.stroke();
          c.restore();
        } else {
          c.save();
          c.globalAlpha = seg(t, 2, 3);
          text(c, 'shared spaces φ, ψ · task-specific matrices', 190, L.phi.y - 36 + 0, { size: 11.5, color: th.muted, align: 'center', th });
          c.restore();
        }

        // task matrices
        L.mat.cy.forEach((cy, k) => {
          const prog = seg(t, 4.2 + 0.6 * k, 5.4 + 0.6 * k);
          if (prog <= 0) return;
          const size = matrix(c, L.mat.cx, cy, L.mat.cell, M.taskMatrices[k], th.series[k], prog, dim);
          c.save();
          c.globalAlpha = dim * seg(t, 4.2 + 0.6 * k, 4.8 + 0.6 * k);
          text(c, `k = ${k + 1}`, L.mat.cx, cy + size / 2 + 14, { size: 11, color: th.muted, align: 'center', th });
          c.restore();
        });
        if (L.wideLayout) {
          c.save();
          c.globalAlpha = seg(t, 5, 6) * dim;
          text(c, 'task-specific matrices', L.mat.cx, 392, { size: 12, color: th.muted, weight: 600, align: 'center', th });
          c.restore();
        }

        // new system, observations and the closed-form matrix
        if (newIn > 0) {
          const k = 1, b = L.sys[k];
          c.save();
          c.globalAlpha = newIn;
          const bb = { ...b, y: b.y + (1 - newIn) * 16 };
          potentialPanel(c, bb, M.newSystem, newSwarm, th.ink, newIn, th, 'new system');
          c.strokeStyle = th.ink; c.lineWidth = 1.4;
          const path = flowPath(b, k);
          partialLine(c, path, seg(t, 9.4, 10.2));
          // observations travelling into the frozen spaces
          for (let i = 0; i < 8; i++) {
            const s = seg(t, 10.2 + 0.18 * i, 11.2 + 0.18 * i);
            if (s <= 0 || s >= 1) continue;
            const p = path[Math.round(s * (path.length - 1))];
            dot(c, p[0], p[1], 3, th.ink, th.surface, 1.5);
          }
          c.restore();

          const mIn = seg(t, 11, 12.6);
          if (mIn > 0) {
            const cy = L.mat.cy[k], cell = L.mat.cell;
            const size = 4 * cell + 6;
            c.save();
            c.globalAlpha = seg(t, 11, 11.4);
            roundRect(c, L.mat.cx - size / 2 - 10, cy - size / 2 - 26, size + 20, size + 48, 10);
            c.fillStyle = th.surface; c.fill();
            c.strokeStyle = th.ink; c.lineWidth = 1; c.stroke();
            c.strokeStyle = th.ink; c.lineWidth = 1.4;
            const half = size / 2;
            c.beginPath();
            c.moveTo(phi.x + phi.w, cy); c.lineTo(L.mat.cx - half - 10, cy);
            c.moveTo(L.mat.cx + half + 10, cy); c.lineTo(psi.x, cy);
            c.stroke();
            text(c, 'M*', L.mat.cx, cy - half - 9, { size: 15, font: 'serif', italic: true, align: 'center', th });
            text(c, 'closed form', L.mat.cx, cy + half + 15, { size: 10.5, color: th.muted, align: 'center', th });
            c.restore();
            matrix(c, L.mat.cx, cy, cell, M.newMatrix, th.ink, mIn, 1);
          }
        }

        densityPanel(c, L.dens, t, th);
      },
    };
  }

  // ---------- DOODL: a dictionary of dynamics ----------
  function doodlScene(P) {
    const surf = (u, v) => 0.46 * (u * u - v * v) + 0.2 * Math.sin(2.2 * u + 0.6) * Math.cos(1.7 * v) - 0.18 * u * v;
    const r = rng(P.cloud.seed);
    const cloud = Array.from({ length: P.cloud.n }, (_, i) => {
      const a = P.atoms[i % 3], spread = i % 5 === 0 ? 0.9 : P.cloud.spread;
      const u = clamp(a[0] * 0.55 + gauss(r) * spread, -0.95, 0.95), v = clamp(a[1] * 0.55 + gauss(r) * spread, -0.95, 0.95);
      return { u, v, dz: gauss(r) * 0.035, t: r() };
    });
    const alphaAt = t => {
      const s = ease(seg(t, 8.4, 12.2));
      return P.alphaInit.map((a, k) => lerp(a, P.alphaFinal[k], s)); // stays on the simplex
    };
    const uvOf = al => [0, 1].map(j => al.reduce((s, a, k) => s + a * P.atoms[k][j], 0));
    const traj = (() => {
      const q = rng(3);
      let x = 0.9, y = 0, vx = 0, vy = 0.8;
      return Array.from({ length: 90 }, () => {
        const ax = -x - 0.25 * vx + 0.5 * gauss(q), ay = -1.6 * y - 0.25 * vy + 0.5 * gauss(q);
        vx += ax * 0.08; vy += ay * 0.08; x += vx * 0.08; y += vy * 0.08;
        return [x, y];
      });
    })();

    function projector(L, t) {
      const yaw = -0.62 + 0.05 * Math.sin(t * 0.35), pitch = 0.86;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      return (u, v, z = surf(u, v)) => {
        const x = u * cy - v * sy, y = u * sy + v * cy;
        const y2 = y * cp + z * sp, depth = y * sp - z * cp;
        const f = 1 / (1 + 0.22 * depth);
        return [L.cx + L.S * x * f, L.cy - L.S * y2 * f, depth];
      };
    }

    const wide = { w: 900, h: 420, cx: 318, cy: 212, S: 182, inset: { x: 646, y: 34, w: 236, h: 118 }, bars: { x: 646, y: 206, w: 236 } };
    const narrow = { w: 380, h: 690, cx: 184, cy: 200, S: 146, inset: { x: 22, y: 382, w: 336, h: 110 }, bars: { x: 22, y: 540, w: 336 } };

    return {
      duration: 16.5,
      wide, narrow,
      steps: [
        [0, 'Operators of related systems lie near a curved manifold.'],
        [2.6, 'A dictionary of three atoms Ḡ₁, Ḡ₂, Ḡ₃ lives on that manifold.'],
        [4.8, 'Reconstructions B(α, Ḡ) cover a curved region between the atoms.'],
        [6.2, 'A new system is observed only through a short trajectory.'],
        [8.4, 'Its coefficients α are estimated on the simplex from that trajectory.'],
        [12.4, 'Spectral components are combined with α, then projected back onto the manifold.'],
        [14.4, 'Short trajectories. Compact representations.'],
      ],
      draw(c, t, L, th) {
        const pr = projector(L, t);
        const meshA = seg(t, 0, 1.4);

        // mesh
        const N = 18;
        c.save();
        c.lineWidth = 0.7;
        c.strokeStyle = th.muted;
        for (let dir = 0; dir < 2; dir++)
          for (let i = 0; i <= N; i++) {
            const a = -1 + (2 * i) / N;
            const pts = Array.from({ length: 41 }, (_, j) => {
              const b = -1 + (2 * j) / 40;
              return dir ? pr(a, b) : pr(b, a);
            });
            c.globalAlpha = meshA * (i % 3 === 0 ? 0.42 : 0.2);
            partialLine(c, pts, seg(t, 0, 1.6));
          }
        c.restore();

        // population of operators
        const cloudA = seg(t, 0.6, 2.4);
        c.save();
        for (const p of cloud) {
          const a = clamp((cloudA - p.t * 0.6) / 0.4);
          if (a <= 0) continue;
          const [x, y] = pr(p.u, p.v, surf(p.u, p.v) + p.dz);
          c.globalAlpha = a * 0.5;
          dot(c, x, y, 2, th.muted);
        }
        c.restore();

        // region of reconstructions: image of the simplex, lifted onto the surface
        const spanA = seg(t, 4.8, 6);
        if (spanA > 0) {
          const edge = [];
          for (let e = 0; e < 3; e++)
            for (let i = 0; i < 20; i++) {
              const s = i / 20, al = [0, 0, 0];
              al[e] = 1 - s; al[(e + 1) % 3] = s;
              const [u, v] = uvOf(al);
              edge.push(pr(u, v));
            }
          c.save();
          c.beginPath();
          edge.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
          c.closePath();
          c.globalAlpha = spanA * 0.1;
          c.fillStyle = th.ink; c.fill();
          c.globalAlpha = spanA * 0.55;
          c.setLineDash([4, 4]); c.strokeStyle = th.muted; c.lineWidth = 1; c.stroke();
          c.restore();
        }

        const al = alphaAt(t);
        const [nu, nv] = uvOf(al);
        const np = pr(nu, nv);

        // curved links from atoms to the new operator, along the surface
        const linkA = seg(t, 8.4, 9.4);
        if (linkA > 0)
          P.atoms.forEach((a, k) => {
            const pts = Array.from({ length: 30 }, (_, i) => {
              const s = i / 29;
              return pr(lerp(a[0], nu, s), lerp(a[1], nv, s));
            });
            c.save();
            c.globalAlpha = 0.85;
            c.strokeStyle = th.series[k];
            c.lineWidth = 0.8 + 4 * al[k];
            c.lineCap = 'round';
            partialLine(c, pts, linkA);
            c.restore();
          });

        // atoms
        const sub = ['₁', '₂', '₃'];
        P.atoms.forEach((a, k) => {
          const A = ease(seg(t, 2.6 + 0.5 * k, 3.2 + 0.5 * k));
          if (A <= 0) return;
          const [x, y] = pr(a[0], a[1]);
          c.save();
          c.globalAlpha = A;
          dot(c, x, y, 6.5 * (0.6 + 0.4 * A), th.series[k], th.surface, 2);
          text(c, `Ḡ${sub[k]}`, x + 11, y - 9, { size: 17, font: 'serif', italic: true, th });
          c.restore();
        });

        // combination then projection P_N (shown at the end)
        const projA = seg(t, 12.4, 13.4);
        if (projA > 0) {
          const P3 = P.atoms.map(a => [a[0], a[1], surf(a[0], a[1])]);
          // the combination leaves the manifold; its offset is exaggerated here (schematic geometry)
          const g = [0, 1, 2].map(j => al.reduce((s, w, k) => s + w * P3[k][j], 0));
          const off = Math.sign(g[2] - surf(nu, nv) || 1) * 0.3;
          const gp = pr(nu, nv, surf(nu, nv) + off);
          c.save();
          c.globalAlpha = projA;
          c.setLineDash([3, 3]); c.strokeStyle = th.ink; c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(gp[0], gp[1]); c.lineTo(np[0], np[1]); c.stroke();
          c.setLineDash([]);
          c.beginPath(); c.arc(gp[0], gp[1], 4.5, 0, 2 * Math.PI); c.lineWidth = 1.4; c.stroke();
          text(c, 'Σ α·(Λ̄, L̄, R̄)', gp[0], gp[1] - 10, { size: 12.5, font: 'serif', italic: true, align: 'center', color: th.muted, th });
          const mx = (gp[0] + np[0]) / 2, my = (gp[1] + np[1]) / 2;
          text(c, 'P', mx - 14, my + 4, { size: 13, font: 'serif', italic: true, th });
          text(c, 'N', mx - 6, my + 8, { size: 9, font: 'serif', italic: true, th });
          c.restore();
        }

        // new operator
        if (t >= 8.4) {
          c.save();
          c.globalAlpha = seg(t, 8.4, 8.9);
          dot(c, np[0], np[1], 6.5, th.ink, th.surface, 2.2);
          text(c, 'B(α, Ḡ)', np[0] + 12, np[1] - 10, { size: 14, font: 'serif', italic: true, th });
          c.restore();
        }

        // inset: short trajectory of the new system
        const inA = seg(t, 6.2, 6.8);
        if (inA > 0) {
          const B = L.inset;
          c.save();
          c.globalAlpha = inA;
          roundRect(c, B.x, B.y, B.w, B.h, 10);
          c.fillStyle = th.surface; c.fill();
          c.strokeStyle = th.line; c.lineWidth = 1; c.stroke();
          text(c, 'new system · short trajectory', B.x + 12, B.y + 20, { size: 12, color: th.muted, weight: 600, th });
          const xs = traj.map(p => p[0]), ys = traj.map(p => p[1]);
          const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
          const pts = traj.map(([x, y]) => [B.x + 16 + ((x - x0) / (x1 - x0)) * (B.w - 32), B.y + 32 + ((y - y0) / (y1 - y0)) * (B.h - 44)]);
          c.strokeStyle = th.ink; c.lineWidth = 1.5; c.lineJoin = 'round';
          partialLine(c, pts, seg(t, 6.4, 8));
          const p = pts[Math.round(seg(t, 6.4, 8) * (pts.length - 1))];
          dot(c, p[0], p[1], 3, th.ink);
          c.restore();
        }

        // coefficient bars
        const barA = seg(t, 7.8, 8.4);
        if (barA > 0) {
          const B = L.bars, rowH = 32, labW = 34, valW = 44, maxW = B.w - labW - valW;
          c.save();
          c.globalAlpha = barA;
          text(c, 'coefficients α', B.x, B.y, { size: 12, color: th.muted, weight: 600, th });
          al.forEach((a, k) => {
            const y = B.y + 20 + k * rowH;
            text(c, `α${sub[k]}`, B.x, y + 15, { size: 15, font: 'serif', italic: true, th });
            roundRect(c, B.x + labW, y + 3, maxW, 14, 4);
            c.fillStyle = th.line; c.fill();
            roundRect(c, B.x + labW, y + 3, Math.max(6, maxW * a), 14, 4);
            c.fillStyle = th.series[k]; c.fill();
            text(c, a.toFixed(2), B.x + B.w, y + 15, { size: 13, align: 'right', th });
          });
          text(c, 'α ≥ 0 · α₁ + α₂ + α₃ = 1', B.x, B.y + 20 + 3 * rowH + 12, { size: 12, color: th.muted, th });
          c.restore();
        }
      },
    };
  }

  // ---------- plasma: real snapshots, compact ----------
  function plasma(root) {
    const P = D.plasma;
    const cv = root.querySelector('canvas'), ctx = cv.getContext('2d');
    const btn = root.querySelector('.plasma-btn');
    const work = document.createElement('canvas'), wctx = work.getContext('2d', { willReadFrequently: true });
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const stops = P.cmap.map(hex);
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(x)), f = x - k;
      for (let j = 0; j < 3; j++) lut[3 * i + j] = lerp(stops[k][j], stops[k + 1][j], f);
    }
    let img = null, playing = !reduce, visible = false, raf = null, t0 = 0, frameIdx = 0;

    function draw() {
      if (!img || !img.complete || !img.naturalWidth) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
      if (!W || !H) return;
      if (cv.width !== W || cv.height !== H) { cv.width = work.width = W; cv.height = work.height = H; }
      // cover: crop the 2:1 frame to the canvas aspect ratio, centred
      const i = frameIdx % P.frames, fx = (i % P.cols) * P.w, fy = Math.floor(i / P.cols) * P.h;
      let sw = P.w, sh = P.h;
      if (W / H > P.w / P.h) sh = (P.w * H) / W; else sw = (P.h * W) / H;
      wctx.imageSmoothingEnabled = true;
      wctx.imageSmoothingQuality = 'high';
      wctx.drawImage(img, fx + (P.w - sw) / 2, fy + (P.h - sh) / 2, sw, sh, 0, 0, W, H);
      try {
        const id = wctx.getImageData(0, 0, W, H), px = id.data;
        for (let q = 0; q < px.length; q += 4) {
          const g = 3 * px[q];
          px[q] = lut[g]; px[q + 1] = lut[g + 1]; px[q + 2] = lut[g + 2];
        }
        ctx.putImageData(id, 0, 0);
      } catch (e) {
        ctx.drawImage(work, 0, 0); // pixel access blocked (file://): grey levels
      }
    }
    function loop(now) {
      raf = null;
      if (!playing || !visible) return;
      const i = Math.floor(((now - t0) / 1000) * P.fps);
      if (i !== frameIdx) { frameIdx = i; draw(); }
      raf = requestAnimationFrame(loop);
    }
    function start() {
      if (raf || !playing || !visible) return;
      t0 = performance.now() - (frameIdx / P.fps) * 1000;
      raf = requestAnimationFrame(loop);
    }
    function setBtn() {
      btn.textContent = playing ? '❚❚' : '▶';
      btn.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
    }
    btn.addEventListener('click', () => { playing = !playing; setBtn(); start(); });
    setBtn();
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !img) {
        img = new Image();
        img.onload = draw;
        img.src = P.file;
      }
      start();
    }, { threshold: 0.2 }).observe(root);
    new ResizeObserver(draw).observe(cv);
  }

  // ---------- wire up ----------
  document.querySelectorAll('.viz[data-viz]').forEach(fig => {
    const scene = fig.dataset.viz === 'mtl' ? mtlScene(D.mtl) : doodlScene(D.doodl);
    new Player(fig, scene);
  });
  const pl = document.querySelector('.plasma');
  if (pl) plasma(pl);

  // redraw still frames when the theme changes
  const redraw = () => players.forEach(p => p.draw());
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
  document.fonts?.ready.then(redraw);
})();
