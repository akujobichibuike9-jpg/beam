/* beam chat wallpapers — 15 original doodle patterns in beam's colours. */
(() => {
  'use strict';
  const INK = '#0E1116';
  const B2 = '#9CCBF5';
  const B3 = '#7DB8EE';
  const B5 = '#4A9BE8';

  // Each pattern: a name, a base colour, a tile size and the SVG inside the tile.
  const g = (o, body) => `<g stroke-linecap="round" stroke-linejoin="round" ${/fill=/.test(o) ? '' : 'fill="none"'} ${o}>${body}</g>`;
  const at = (x, y, r, s, inner) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">${inner}</g>`;

  const plane = '<path d="M0 0L24 9 0 18 6 9z M6 9H24"/>';
  const beamMark = '<path d="M0 26C2 12 12 4 22 6"/><rect x="18" y="-2" width="12" height="12" rx="3.5" transform="rotate(14 24 4)"/>';
  const star4 = '<path d="M0-9Q0 0 9 0Q0 0 0 9Q0 0-9 0Q0 0 0-9z"/>';
  const heart = '<path d="M0 6C-9-1-7-9-2-9 0-9 0-7 0-6 0-7 0-9 2-9 7-9 9-1 0 6z"/>';
  const cloud = '<path d="M-14 6H14A6 6 0 0 0 12-5 9 9 0 0 0-5-7 7 7 0 0 0-14 6z"/>';
  const note = '<path d="M0 10V-8L10-10V8"/><circle cx="-3" cy="10" r="3"/><circle cx="7" cy="8" r="3"/>';
  const bubble = '<path d="M-14-8H14Q18-8 18-4V4Q18 8 14 8H-4L-10 13V8H-14Q-18 8-18 4V-4Q-18-8-14-8z"/><circle cx="-6" cy="0" r=".8"/><circle cx="0" cy="0" r=".8"/><circle cx="6" cy="0" r=".8"/>';
  const pencil = '<path d="M-16 4L10-12 16-6-10 10z M10-12 16-6 M-16 4-18 12-10 10"/>';
  const book = '<path d="M0-8C-6-11-12-11-16-9V9C-12 7-6 7 0 10 6 7 12 7 16 9V-9C12-11 6-11 0-8z M0-8V10"/>';
  const bulb = '<path d="M-5 6C-5 2-9 0-9-5A9 9 0 0 1 9-5C9 0 5 2 5 6z M-4 10H4 M-3 13H3"/>';
  const smile = '<circle r="10"/><path d="M-4 3Q0 7 4 3"/><circle cx="-3.5" cy="-3" r=".6"/><circle cx="3.5" cy="-3" r=".6"/>';
  const bolt = '<path d="M2-12L-6 2H1L-2 12 7-3H0z"/>';
  const planet = '<circle r="8"/><ellipse rx="15" ry="4.5" transform="rotate(-18)"/>';
  const rocket = '<path d="M0-14C6-8 6 2 4 8H-4C-6 2-6-8 0-14z M-4 4-9 10-4 9 M4 4 9 10 4 9 M-2 11 0 15 2 11"/><circle cy="-4" r="2"/>';

  const WALLS = [
    { name: 'Paper planes', base: '#EEF5FC', size: 220, svg: () =>
      g(`stroke="${B3}" stroke-width="1.6"`, at(30, 40, -14, 1, plane) + at(150, 30, 10, 0.8, plane) + at(90, 120, -24, 1.1, plane) + at(180, 170, 6, 0.9, plane) + at(30, 180, -6, 0.7, plane)) +
      g(`stroke="${B2}" stroke-width="1.4" stroke-dasharray="2 6"`, '<path d="M10 70Q50 90 80 118 M120 60Q150 80 170 160"/>') },
    { name: 'Beams', base: '#E6F0FB', size: 200, svg: () =>
      g(`stroke="${B3}" stroke-width="2"`, at(20, 40, 0, 1, beamMark) + at(120, 20, 20, 0.8, beamMark) + at(80, 120, -10, 1.1, beamMark) + at(160, 150, 8, 0.7, beamMark)) +
      g(`stroke="${INK}" stroke-opacity=".12" stroke-width="1.5"`, at(60, 90, 0, 0.5, star4) + at(170, 90, 0, 0.6, star4)) },
    { name: 'Dots', base: '#F3F8FD', size: 40, svg: () =>
      `<circle cx="10" cy="10" r="2" fill="${B2}"/><circle cx="30" cy="30" r="2" fill="${B3}" fill-opacity=".7"/>` },
    { name: 'Confetti', base: '#EEF5FC', size: 180, svg: () => {
      const bits = [[20, 30, 20, B3], [60, 15, -30, INK], [110, 40, 45, B2], [150, 20, 10, B5], [35, 90, -10, B2], [90, 80, 60, B3], [140, 95, -40, INK], [20, 150, 30, B5], [70, 140, -15, B3], [125, 150, 20, B2], [165, 130, 70, B3]];
      return bits.map(([x, y, r, c], i) => (i % 3 === 0
        ? `<rect x="${x}" y="${y}" width="10" height="4" rx="2" fill="${c}" fill-opacity="${c === INK ? 0.18 : 0.6}" transform="rotate(${r} ${x} ${y})"/>`
        : i % 3 === 1 ? `<circle cx="${x}" cy="${y}" r="3" fill="${c}" fill-opacity="${c === INK ? 0.18 : 0.55}"/>`
          : `<path d="M${x} ${y}l5 9h-10z" fill="${c}" fill-opacity=".5" transform="rotate(${r} ${x} ${y})"/>`)).join('');
    } },
    { name: 'Sparkles', base: '#E6F0FB', size: 170, svg: () =>
      g(`stroke="${B3}" stroke-width="1.6"`, at(30, 30, 0, 1, star4) + at(120, 50, 0, 0.6, star4) + at(70, 110, 0, 1.3, star4) + at(150, 140, 0, 0.8, star4) + at(20, 140, 0, 0.5, star4)) +
      `<circle cx="95" cy="25" r="1.6" fill="${B5}"/><circle cx="150" cy="95" r="1.6" fill="${B5}"/><circle cx="40" cy="80" r="1.4" fill="${INK}" fill-opacity=".2"/>` },
    { name: 'Clouds', base: '#EAF2FB', size: 220, svg: () =>
      g(`stroke="${B3}" stroke-width="1.8" fill="#fff" fill-opacity=".85"`, at(50, 50, 0, 1.2, cloud) + at(160, 100, 0, 0.9, cloud) + at(70, 170, 0, 1, cloud)) +
      g(`stroke="${B3}" stroke-width="1.4"`, at(170, 30, 0, 0.5, star4) + at(20, 120, 0, 0.4, star4)) },
    { name: 'Waves', base: '#EEF5FC', size: 120, svg: () =>
      g(`stroke="${B2}" stroke-width="1.8"`, '<path d="M0 20Q15 10 30 20T60 20T90 20T120 20 M0 60Q15 50 30 60T60 60T90 60T120 60 M0 100Q15 90 30 100T60 100T90 100T120 100"/>') +
      g(`stroke="${B3}" stroke-width="1.4" stroke-opacity=".6"`, '<path d="M0 40Q15 32 30 40T60 40T90 40T120 40 M0 80Q15 72 30 80T60 80T90 80T120 80"/>') },
    { name: 'Notebook', base: '#F6F9FD', size: 28, svg: () =>
      `<path d="M0 27.5H28" stroke="${B2}" stroke-width="1"/>` },
    { name: 'Graph paper', base: '#F3F8FD', size: 24, svg: () =>
      `<path d="M0 .5H24M.5 0V24" stroke="${B2}" stroke-width="1" stroke-opacity=".8"/>` },
    { name: 'Study doodles', base: '#EEF5FC', size: 240, svg: () =>
      g(`stroke="${B3}" stroke-width="1.7"`, at(40, 40, -8, 1, pencil) + at(170, 50, 6, 1, book) + at(100, 130, 0, 1.1, bulb) + at(40, 200, 10, 0.9, book) + at(190, 190, -20, 0.9, pencil)) +
      `<text x="150" y="128" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="22" fill="${INK}" fill-opacity=".14" transform="rotate(-10 150 128)">A+</text>` +
      `<text x="20" y="120" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="16" fill="${B3}" fill-opacity=".8" transform="rotate(8 20 120)">π</text>` },
    { name: 'Chatter', base: '#E6F0FB', size: 200, svg: () =>
      g(`stroke="${B3}" stroke-width="1.6"`, at(40, 40, -6, 1, bubble) + at(150, 70, 8, 0.8, bubble) + at(70, 140, 4, 0.9, bubble) + at(170, 170, -10, 0.7, bubble)) },
    { name: 'Hearts', base: '#EEF5FC', size: 160, svg: () =>
      g(`stroke="${B3}" stroke-width="1.6"`, at(30, 30, -10, 1.3, heart) + at(110, 40, 12, 0.9, heart) + at(70, 100, 0, 1.6, heart) + at(140, 130, -15, 1, heart) + at(25, 130, 8, 0.8, heart)) },
    { name: 'Music', base: '#EAF2FB', size: 190, svg: () =>
      g(`stroke="${B3}" stroke-width="1.7"`, at(30, 40, -8, 1, note) + at(130, 30, 10, 0.8, note) + at(90, 110, -4, 1.2, note) + at(160, 150, 8, 0.9, note) + at(30, 160, 4, 0.8, note)) +
      g(`stroke="${B2}" stroke-width="1.4"`, '<path d="M0 85Q20 75 40 85T80 85 M110 75Q130 65 150 75T190 75"/>') },
    { name: 'Space', base: '#E6F0FB', size: 230, svg: () =>
      g(`stroke="${B3}" stroke-width="1.7"`, at(50, 50, 0, 1.2, planet) + at(170, 140, 0, 0.9, planet) + at(160, 40, 20, 1, rocket) + at(60, 170, -15, 0.9, rocket)) +
      g(`stroke="${INK}" stroke-opacity=".16" stroke-width="1.4"`, at(110, 100, 0, 0.5, star4) + at(20, 110, 0, 0.4, star4) + at(210, 210, 0, 0.5, star4)) },
    { name: 'Doodle mix', base: '#EEF5FC', size: 220, svg: () =>
      g(`stroke="${B3}" stroke-width="1.7"`, at(40, 40, -8, 1.1, smile) + at(150, 40, 12, 1, bolt) + at(100, 110, 0, 1, '<path d="M-14 0Q-7-10 0 0T14 0"/>') + at(40, 170, 0, 1, '<path d="M-12 8L0-10 12 8z"/>') + at(170, 160, -6, 1, smile) + at(190, 100, 0, 0.6, star4)) +
      g(`stroke="${INK}" stroke-opacity=".14" stroke-width="1.6"`, '<path d="M90 190l8-8 8 8 8-8 8 8"/>') }
  ];

  const urlFor = (w) => `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w.size}" height="${w.size}" viewBox="0 0 ${w.size} ${w.size}">${w.svg()}</svg>`)}")`;
  const cache = new Map();
  function css(i) {
    if (!cache.has(i)) cache.set(i, urlFor(WALLS[i]));
    return cache.get(i);
  }

  function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>>= 0; }
  function pick(roomId) {
    try {
      const saved = localStorage.getItem(`beam_wall_${roomId}`);
      if (saved !== null && WALLS[Number(saved)]) return Number(saved);
    } catch { /* ignore */ }
    return hash(roomId) % WALLS.length;
  }
  function choose(roomId, i) {
    try { localStorage.setItem(`beam_wall_${roomId}`, String(i)); } catch { /* ignore */ }
  }

  function apply(el, i) {
    const w = WALLS[i];
    if (!w) return;
    if (el.dataset.wall === String(i)) return;
    el.dataset.wall = String(i);
    el.style.setProperty('--wall-base', w.base);
    el.style.setProperty('--wall-img', css(i));
    el.style.setProperty('--wall-size', `${w.size}px`);
    el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap');
  }

  function swatch(i, selected) {
    const w = WALLS[i];
    return `<button class="wall-sw ${selected ? 'on' : ''}" data-act="wall" data-i="${i}" aria-pressed="${selected}" aria-label="${w.name}" title="${w.name}" style="background-color:${w.base};background-image:${css(i)};background-size:${Math.round(w.size * 0.5)}px"></button>`;
  }

  window.beamWalls = { count: WALLS.length, names: WALLS.map((w) => w.name), pick, choose, apply, swatch };
})();
