// Builds the DOM for a single running timer. Every visual style is a builder
// that returns an `update(ctx)` closure; the shell (frame, media, text, label)
// is shared so all styles get the same customization options.

import { FONT_MAP } from './defaults.js';
import { describeArc, escapeHtml, polarToCartesian, rgba } from './utils.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const VB = 100; // every circular style draws in a 0 0 100 100 viewBox

const CIRCULAR = new Set([
  'ring', 'ring-minute', 'ring-dual', 'ring-segments', 'ring-ticks', 'ring-gradient',
  'ring-neon', 'ring-dashed', 'ring-double-track', 'orbit', 'spiral', 'pie', 'gauge',
  'liquid', 'radar', 'analog', 'pulse', 'hourglass',
]);

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function makeSvg() {
  const svg = svgEl('svg', { viewBox: `0 0 ${VB} ${VB}`, class: 'timer-svg' });
  return svg;
}

function geometry(cfg) {
  const scale = VB / Math.max(1, cfg.size);
  const t = Math.max(0.6, cfg.thickness * scale);
  const r = Math.max(6, 50 - t / 2 - 1.5);
  return { t, r, circ: 2 * Math.PI * r };
}

function ringTransform(cfg) {
  const angle = -90 + (cfg.start_angle || 0);
  return cfg.spin === 'ccw'
    ? `rotate(${angle} 50 50) scale(-1 1) translate(-100 0)`
    : `rotate(${angle} 50 50)`;
}

// ---------------------------------------------------------------------------
// Builders. Each receives (cfg, art) and returns update(ctx).
// ---------------------------------------------------------------------------

function buildRing(cfg, art, opts = {}) {
  const { t, r, circ } = geometry(cfg);
  const svg = makeSvg();
  const g = svgEl('g', { transform: ringTransform(cfg) });
  const track = svgEl('circle', {
    class: 'tr-track', cx: 50, cy: 50, r, 'stroke-width': t,
  });
  const fg = svgEl('circle', {
    class: 'tr-fg', cx: 50, cy: 50, r, 'stroke-width': t,
    'stroke-dasharray': circ.toFixed(2), 'stroke-dashoffset': 0,
    'stroke-linecap': opts.square ? 'butt' : 'round',
  });
  if (opts.dashed) {
    const dash = circ / 60;
    track.setAttribute('stroke-dasharray', `${(dash * 0.55).toFixed(2)} ${(dash * 0.45).toFixed(2)}`);
    fg.setAttribute('stroke-dasharray', `${(dash * 0.55).toFixed(2)} ${(dash * 0.45).toFixed(2)}`);
  }
  if (opts.gradient) {
    const id = `grad-${Math.random().toString(36).slice(2, 8)}`;
    const defs = svgEl('defs');
    const lg = svgEl('linearGradient', { id, x1: '0', y1: '0', x2: '1', y2: '1' });
    lg.appendChild(svgEl('stop', { offset: '0%', 'stop-color': cfg.color }));
    lg.appendChild(svgEl('stop', { offset: '100%', 'stop-color': cfg.color2 }));
    defs.appendChild(lg);
    svg.appendChild(defs);
    fg.setAttribute('stroke', `url(#${id})`);
    fg.classList.add('tr-fixed-stroke');
  }
  g.append(track, fg);
  svg.appendChild(g);

  let head = null;
  if (opts.head) {
    head = svgEl('circle', { class: 'tr-head', cx: 50, cy: 50 - r, r: Math.max(1.2, t * 0.62) });
    g.appendChild(head);
  }
  art.appendChild(svg);

  let last = -1;
  return (ctx) => {
    if (opts.dashed) {
      // Dashed rings look better when the gap pattern stays fixed and only the
      // visible arc length changes, so mask with a second dash cycle.
      fg.setAttribute('stroke-dasharray', `${(circ * ctx.p).toFixed(2)} ${circ.toFixed(2)}`);
    } else if (Math.abs(ctx.p - last) > 0.0005) {
      fg.setAttribute('stroke-dashoffset', (circ * (1 - ctx.p)).toFixed(2));
    }
    if (head && Math.abs(ctx.p - last) > 0.0005) {
      const pt = polarToCartesian(50, 50, r, ctx.p * 360);
      head.setAttribute('cx', pt.x.toFixed(2));
      head.setAttribute('cy', pt.y.toFixed(2));
      head.setAttribute('opacity', ctx.p > 0.004 ? '1' : '0');
    }
    last = ctx.p;
  };
}

function buildRingMinute(cfg, art) {
  const { t, r, circ } = geometry(cfg);
  const innerR = Math.max(4, r - t * 1.6);
  const innerCirc = 2 * Math.PI * innerR;
  const svg = makeSvg();
  const g = svgEl('g', { transform: ringTransform(cfg) });

  const track = svgEl('circle', { class: 'tr-track', cx: 50, cy: 50, r, 'stroke-width': t });
  const minute = svgEl('circle', {
    class: 'tr-fg', cx: 50, cy: 50, r, 'stroke-width': t, 'stroke-linecap': 'round',
    'stroke-dasharray': circ.toFixed(2), 'stroke-dashoffset': circ.toFixed(2),
  });
  const totalTrack = svgEl('circle', {
    class: 'tr-track tr-track-soft', cx: 50, cy: 50, r: innerR, 'stroke-width': Math.max(0.8, t * 0.38),
  });
  const total = svgEl('circle', {
    class: 'tr-alt', cx: 50, cy: 50, r: innerR, 'stroke-width': Math.max(0.8, t * 0.38),
    'stroke-linecap': 'round', 'stroke-dasharray': innerCirc.toFixed(2), 'stroke-dashoffset': 0,
  });
  g.append(track, totalTrack, minute, total);
  svg.appendChild(g);
  art.appendChild(svg);

  return (ctx) => {
    const secondsInMinute = ctx.remaining % 60;
    // Fills from empty to full over the course of every minute.
    const minuteFill = ctx.remaining <= 0 ? 1 : 1 - secondsInMinute / 60;
    minute.setAttribute('stroke-dashoffset', (circ * (1 - minuteFill)).toFixed(2));
    const totalP = ctx.total > 0 ? ctx.remaining / ctx.total : 0;
    total.setAttribute('stroke-dashoffset', (innerCirc * (1 - totalP)).toFixed(2));
  };
}

function buildRingDual(cfg, art) {
  const { t, r, circ } = geometry(cfg);
  const innerR = Math.max(4, r - t * 1.9);
  const innerCirc = 2 * Math.PI * innerR;
  const svg = makeSvg();
  const g = svgEl('g', { transform: ringTransform(cfg) });
  const trackOuter = svgEl('circle', { class: 'tr-track', cx: 50, cy: 50, r, 'stroke-width': t });
  const outer = svgEl('circle', {
    class: 'tr-fg', cx: 50, cy: 50, r, 'stroke-width': t, 'stroke-linecap': 'round',
    'stroke-dasharray': circ.toFixed(2), 'stroke-dashoffset': 0,
  });
  const trackInner = svgEl('circle', { class: 'tr-track tr-track-soft', cx: 50, cy: 50, r: innerR, 'stroke-width': t * 0.6 });
  const inner = svgEl('circle', {
    class: 'tr-alt', cx: 50, cy: 50, r: innerR, 'stroke-width': t * 0.6, 'stroke-linecap': 'round',
    'stroke-dasharray': innerCirc.toFixed(2), 'stroke-dashoffset': 0,
  });
  g.append(trackOuter, trackInner, outer, inner);
  svg.appendChild(g);
  art.appendChild(svg);

  return (ctx) => {
    outer.setAttribute('stroke-dashoffset', (circ * (1 - ctx.p)).toFixed(2));
    const minuteP = ctx.remaining <= 0 ? 0 : (ctx.remaining % 60) / 60;
    inner.setAttribute('stroke-dashoffset', (innerCirc * (1 - minuteP)).toFixed(2));
  };
}

function buildRingSegments(cfg, art) {
  const { t, r } = geometry(cfg);
  const count = Math.max(2, Math.min(120, cfg.segments));
  const svg = makeSvg();
  const g = svgEl('g', { transform: ringTransform(cfg) });
  const step = 360 / count;
  const gap = Math.min(step * 0.35, 6);
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a0 = i * step + gap / 2;
    const a1 = (i + 1) * step - gap / 2;
    const p = svgEl('path', {
      class: 'tr-seg', d: describeArc(50, 50, r, a0, a1),
      'stroke-width': t, 'stroke-linecap': 'butt', fill: 'none',
    });
    g.appendChild(p);
    parts.push(p);
  }
  svg.appendChild(g);
  art.appendChild(svg);

  let lastLit = -1;
  return (ctx) => {
    const lit = Math.ceil(ctx.p * count - 0.00001);
    if (lit === lastLit) return;
    lastLit = lit;
    for (let i = 0; i < count; i++) parts[i].classList.toggle('on', i < lit);
  };
}

function buildRingTicks(cfg, art) {
  const { t, r } = geometry(cfg);
  const count = 60;
  const svg = makeSvg();
  const g = svgEl('g', { transform: ringTransform(cfg) });
  const parts = [];
  for (let i = 0; i < count; i++) {
    const angle = (i * 360) / count;
    const major = i % 5 === 0;
    const len = major ? t * 1.9 : t * 1.1;
    const a = polarToCartesian(50, 50, r, angle);
    const b = polarToCartesian(50, 50, r - len, angle);
    const line = svgEl('line', {
      class: 'tr-tick', x1: a.x.toFixed(2), y1: a.y.toFixed(2), x2: b.x.toFixed(2), y2: b.y.toFixed(2),
      'stroke-width': (major ? t * 0.55 : t * 0.32).toFixed(2), 'stroke-linecap': 'round',
    });
    g.appendChild(line);
    parts.push(line);
  }
  svg.appendChild(g);
  art.appendChild(svg);

  let lastLit = -1;
  return (ctx) => {
    const lit = Math.ceil(ctx.p * count - 0.00001);
    if (lit === lastLit) return;
    lastLit = lit;
    for (let i = 0; i < count; i++) parts[i].classList.toggle('on', i < lit);
  };
}

function buildSpiral(cfg, art) {
  const { t, r } = geometry(cfg);
  const minutes = Math.max(1, Math.min(8, Math.ceil(cfg.seconds / 60)));
  const step = (t * 1.7);
  const svg = makeSvg();
  const g = svgEl('g', { transform: ringTransform(cfg) });
  const rings = [];
  for (let i = 0; i < minutes; i++) {
    const rr = r - i * step;
    if (rr < 4) break;
    const circ = 2 * Math.PI * rr;
    const track = svgEl('circle', { class: 'tr-track tr-track-soft', cx: 50, cy: 50, r: rr, 'stroke-width': t * 0.8 });
    const fg = svgEl('circle', {
      class: i === 0 ? 'tr-fg' : 'tr-alt', cx: 50, cy: 50, r: rr, 'stroke-width': t * 0.8,
      'stroke-linecap': 'round', 'stroke-dasharray': circ.toFixed(2), 'stroke-dashoffset': circ.toFixed(2),
    });
    g.append(track, fg);
    rings.push({ fg, circ });
  }
  svg.appendChild(g);
  art.appendChild(svg);

  return (ctx) => {
    // Ring 0 is the minute currently running; deeper rings are minutes already
    // completed, so the figure fills inward.
    const elapsedMin = ctx.elapsed / 60;
    for (let i = 0; i < rings.length; i++) {
      const value = Math.min(1, Math.max(0, elapsedMin - i));
      rings[i].fg.setAttribute('stroke-dashoffset', (rings[i].circ * (1 - value)).toFixed(2));
    }
  };
}

function buildOrbit(cfg, art) {
  const { t, r } = geometry(cfg);
  const svg = makeSvg();
  const g = svgEl('g', { transform: ringTransform(cfg) });
  const track = svgEl('circle', { class: 'tr-track tr-track-soft', cx: 50, cy: 50, r, 'stroke-width': Math.max(0.6, t * 0.35) });
  const trail = svgEl('path', { class: 'tr-fg tr-trail', 'stroke-width': t, 'stroke-linecap': 'round', fill: 'none', d: '' });
  const dot = svgEl('circle', { class: 'tr-head', cx: 50, cy: 50 - r, r: Math.max(1.6, t * 0.85) });
  g.append(track, trail, dot);
  svg.appendChild(g);
  art.appendChild(svg);

  return (ctx) => {
    const angle = ctx.p * 360;
    const from = Math.max(0, angle - 46);
    trail.setAttribute('d', describeArc(50, 50, r, from, angle));
    const pt = polarToCartesian(50, 50, r, angle);
    dot.setAttribute('cx', pt.x.toFixed(2));
    dot.setAttribute('cy', pt.y.toFixed(2));
  };
}

function buildPie(cfg, art) {
  const { r } = geometry(cfg);
  const radius = r + cfg.thickness * (VB / cfg.size) / 2;
  const svg = makeSvg();
  const g = svgEl('g', { transform: ringTransform(cfg) });
  const track = svgEl('circle', { class: 'tr-track-fill', cx: 50, cy: 50, r: radius });
  const wedge = svgEl('path', { class: 'tr-fill', d: '' });
  g.append(track, wedge);
  svg.appendChild(g);
  art.appendChild(svg);

  return (ctx) => {
    const angle = Math.min(359.999, ctx.p * 360);
    if (angle <= 0.01) {
      wedge.setAttribute('d', '');
      return;
    }
    const end = polarToCartesian(50, 50, radius, angle);
    const large = angle > 180 ? 1 : 0;
    wedge.setAttribute('d', `M 50 50 L 50 ${(50 - radius).toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`);
  };
}

function buildGauge(cfg, art) {
  const { t, r } = geometry(cfg);
  const SPAN = 250;
  const START = -SPAN / 2;
  const svg = makeSvg();
  const g = svgEl('g', { transform: `rotate(${cfg.start_angle || 0} 50 50)` });
  const track = svgEl('path', {
    class: 'tr-track', d: describeArc(50, 50, r, START, START + SPAN),
    'stroke-width': t, 'stroke-linecap': 'round', fill: 'none',
  });
  const fg = svgEl('path', { class: 'tr-fg', 'stroke-width': t, 'stroke-linecap': 'round', fill: 'none', d: '' });
  const needle = svgEl('line', { class: 'tr-needle', x1: 50, y1: 50, x2: 50, y2: 50 - r + t, 'stroke-width': Math.max(0.8, t * 0.35), 'stroke-linecap': 'round' });
  const hub = svgEl('circle', { class: 'tr-head', cx: 50, cy: 50, r: Math.max(1.4, t * 0.5) });
  g.append(track, fg, needle, hub);
  svg.appendChild(g);
  art.appendChild(svg);

  return (ctx) => {
    const angle = START + SPAN * ctx.p;
    fg.setAttribute('d', describeArc(50, 50, r, START, angle));
    needle.setAttribute('transform', `rotate(${angle.toFixed(2)} 50 50)`);
  };
}

function buildLiquid(cfg, art) {
  const svg = makeSvg();
  const id = Math.random().toString(36).slice(2, 8);
  const defs = svgEl('defs');
  const clip = svgEl('clipPath', { id: `liq-${id}` });
  clip.appendChild(svgEl('circle', { cx: 50, cy: 50, r: 47 }));
  defs.appendChild(clip);
  svg.appendChild(defs);

  const rim = svgEl('circle', { class: 'tr-track', cx: 50, cy: 50, r: 47, 'stroke-width': Math.max(1, geometry(cfg).t * 0.6) });
  const g = svgEl('g', { 'clip-path': `url(#liq-${id})` });
  const body = svgEl('path', { class: 'tr-fill', d: '' });
  const body2 = svgEl('path', { class: 'tr-fill tr-fill-soft', d: '' });
  g.append(body2, body);
  svg.append(g, rim);
  art.appendChild(svg);

  const wave = (level, phase, amp) => {
    const y = 100 - level * 100;
    let d = `M -10 ${(y).toFixed(2)}`;
    for (let x = -10; x <= 110; x += 10) {
      const yy = y + Math.sin((x / 22) + phase) * amp;
      d += ` L ${x} ${yy.toFixed(2)}`;
    }
    return `${d} L 110 110 L -10 110 Z`;
  };

  return (ctx) => {
    const phase = ctx.now / 420;
    const amp = 2.4;
    body.setAttribute('d', wave(ctx.p, phase, amp));
    body2.setAttribute('d', wave(ctx.p, phase + 1.7, amp * 0.8));
  };
}

function buildHourglass(cfg, art) {
  const svg = makeSvg();
  const id = Math.random().toString(36).slice(2, 8);
  const defs = svgEl('defs');
  const topClip = svgEl('clipPath', { id: `hg-t-${id}` });
  topClip.appendChild(svgEl('path', { d: 'M 22 10 L 78 10 L 54 50 L 46 50 Z' }));
  const botClip = svgEl('clipPath', { id: `hg-b-${id}` });
  botClip.appendChild(svgEl('path', { d: 'M 46 50 L 54 50 L 78 90 L 22 90 Z' }));
  defs.append(topClip, botClip);
  svg.appendChild(defs);

  const frame = svgEl('path', {
    class: 'tr-track', fill: 'none', 'stroke-width': Math.max(1, geometry(cfg).t * 0.5),
    'stroke-linejoin': 'round', d: 'M 22 10 L 78 10 L 54 50 L 78 90 L 22 90 L 46 50 Z',
  });
  const topFill = svgEl('rect', { class: 'tr-fill', x: 0, y: 10, width: 100, height: 40, 'clip-path': `url(#hg-t-${id})` });
  const botFill = svgEl('rect', { class: 'tr-fill', x: 0, y: 90, width: 100, height: 0, 'clip-path': `url(#hg-b-${id})` });
  const stream = svgEl('line', { class: 'tr-stream', x1: 50, y1: 50, x2: 50, y2: 88, 'stroke-width': 1.2 });
  svg.append(topFill, botFill, stream, frame);
  art.appendChild(svg);

  return (ctx) => {
    const top = ctx.p;                 // sand left in the bulb
    const bottom = 1 - ctx.p;
    topFill.setAttribute('y', (50 - 40 * top).toFixed(2));
    topFill.setAttribute('height', (40 * top).toFixed(2));
    botFill.setAttribute('y', (90 - 40 * bottom).toFixed(2));
    botFill.setAttribute('height', (40 * bottom).toFixed(2));
    stream.setAttribute('opacity', top > 0.001 && bottom > 0.001 ? '0.8' : '0');
  };
}

function buildRadar(cfg, art) {
  const { t, r } = geometry(cfg);
  const svg = makeSvg();
  const id = Math.random().toString(36).slice(2, 8);
  const defs = svgEl('defs');
  const grad = svgEl('linearGradient', { id: `rad-${id}`, x1: '0', y1: '0', x2: '1', y2: '0' });
  grad.appendChild(svgEl('stop', { offset: '0%', 'stop-color': cfg.color, 'stop-opacity': '0' }));
  grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': cfg.color, 'stop-opacity': '0.55' }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  for (const rr of [r, r * 0.68, r * 0.36]) {
    svg.appendChild(svgEl('circle', { class: 'tr-track tr-track-soft', cx: 50, cy: 50, r: rr, 'stroke-width': Math.max(0.5, t * 0.28) }));
  }
  svg.appendChild(svgEl('line', { class: 'tr-track tr-track-soft', x1: 50 - r, y1: 50, x2: 50 + r, y2: 50, 'stroke-width': Math.max(0.4, t * 0.2) }));
  svg.appendChild(svgEl('line', { class: 'tr-track tr-track-soft', x1: 50, y1: 50 - r, x2: 50, y2: 50 + r, 'stroke-width': Math.max(0.4, t * 0.2) }));

  const sweep = svgEl('path', { d: `M 50 50 L 50 ${(50 - r).toFixed(2)} A ${r} ${r} 0 0 1 ${polarToCartesian(50, 50, r, 62).x.toFixed(2)} ${polarToCartesian(50, 50, r, 62).y.toFixed(2)} Z`, fill: `url(#rad-${id})` });
  const arc = svgEl('path', { class: 'tr-fg', fill: 'none', 'stroke-width': t * 0.8, 'stroke-linecap': 'round', d: '' });
  svg.append(sweep, arc);
  art.appendChild(svg);

  return (ctx) => {
    sweep.setAttribute('transform', `rotate(${((ctx.now / 9) % 360).toFixed(1)} 50 50)`);
    arc.setAttribute('d', describeArc(50, 50, r, 0, Math.min(359.9, ctx.p * 360)));
  };
}

function buildAnalog(cfg, art) {
  const { t, r } = geometry(cfg);
  const svg = makeSvg();
  const face = svgEl('circle', { class: 'tr-track', cx: 50, cy: 50, r, 'stroke-width': Math.max(1, t * 0.5) });
  svg.appendChild(face);
  for (let i = 0; i < 12; i++) {
    const a = polarToCartesian(50, 50, r - t * 0.6, i * 30);
    const b = polarToCartesian(50, 50, r - t * 1.6, i * 30);
    svg.appendChild(svgEl('line', {
      class: 'tr-tick on', x1: a.x.toFixed(2), y1: a.y.toFixed(2), x2: b.x.toFixed(2), y2: b.y.toFixed(2),
      'stroke-width': (t * 0.32).toFixed(2), 'stroke-linecap': 'round', opacity: 0.45,
    }));
  }
  const minuteHand = svgEl('line', { class: 'tr-alt', x1: 50, y1: 50, x2: 50, y2: 50 - r * 0.58, 'stroke-width': Math.max(1, t * 0.5), 'stroke-linecap': 'round' });
  const secondHand = svgEl('line', { class: 'tr-fg', x1: 50, y1: 50, x2: 50, y2: 50 - r * 0.82, 'stroke-width': Math.max(0.7, t * 0.3), 'stroke-linecap': 'round' });
  const hub = svgEl('circle', { class: 'tr-head', cx: 50, cy: 50, r: Math.max(1.2, t * 0.42) });
  svg.append(minuteHand, secondHand, hub);
  art.appendChild(svg);

  return (ctx) => {
    const seconds = ctx.remaining % 60;
    const minutes = Math.floor(ctx.remaining / 60) % 60;
    secondHand.setAttribute('transform', `rotate(${(seconds * 6).toFixed(2)} 50 50)`);
    minuteHand.setAttribute('transform', `rotate(${(minutes * 6 + seconds * 0.1).toFixed(2)} 50 50)`);
  };
}

function buildPulse(cfg, art) {
  const { t, r } = geometry(cfg);
  const svg = makeSvg();
  const halo = svgEl('circle', { class: 'tr-fill tr-fill-soft', cx: 50, cy: 50, r: r * 0.7 });
  const core = svgEl('circle', { class: 'tr-track', cx: 50, cy: 50, r: r * 0.7, 'stroke-width': t, fill: 'none' });
  const fg = svgEl('circle', {
    class: 'tr-fg', cx: 50, cy: 50, r: r * 0.7, 'stroke-width': t, fill: 'none', 'stroke-linecap': 'round',
    'stroke-dasharray': (2 * Math.PI * r * 0.7).toFixed(2), 'stroke-dashoffset': 0, transform: ringTransform(cfg),
  });
  svg.append(halo, core, fg);
  art.appendChild(svg);
  const circ = 2 * Math.PI * r * 0.7;

  return (ctx) => {
    const speed = ctx.phase === 'danger' ? 3.2 : ctx.phase === 'warning' ? 2 : 1.1;
    const beat = 0.5 + 0.5 * Math.sin((ctx.now / 1000) * speed * Math.PI);
    halo.setAttribute('r', (r * (0.55 + beat * 0.42)).toFixed(2));
    halo.setAttribute('opacity', (0.28 - beat * 0.16).toFixed(3));
    fg.setAttribute('stroke-dashoffset', (circ * (1 - ctx.p)).toFixed(2));
  };
}

// --- linear / grid styles ---------------------------------------------------

function buildBar(cfg, art, vertical) {
  const wrap = document.createElement('div');
  wrap.className = vertical ? 'tr-bar tr-bar-v' : 'tr-bar tr-bar-h';
  const fill = document.createElement('div');
  fill.className = 'tr-bar-fill';
  wrap.appendChild(fill);
  art.appendChild(wrap);
  return (ctx) => {
    const pct = `${(ctx.p * 100).toFixed(2)}%`;
    if (vertical) fill.style.height = pct;
    else fill.style.width = pct;
  };
}

function buildBarSegments(cfg, art, stepped) {
  const count = Math.max(2, Math.min(60, cfg.segments));
  const wrap = document.createElement('div');
  wrap.className = stepped ? 'tr-cells tr-cells-eq' : 'tr-cells';
  const cells = [];
  for (let i = 0; i < count; i++) {
    const cell = document.createElement('span');
    cell.className = 'tr-cell';
    if (stepped) {
      const h = 34 + Math.abs(Math.sin(i * 1.2)) * 66;
      cell.style.height = `${h.toFixed(1)}%`;
    }
    wrap.appendChild(cell);
    cells.push(cell);
  }
  art.appendChild(wrap);
  let lastLit = -1;
  return (ctx) => {
    const lit = Math.ceil(ctx.p * count - 0.00001);
    if (lit === lastLit) return;
    lastLit = lit;
    for (let i = 0; i < count; i++) cells[i].classList.toggle('on', i < lit);
  };
}

function buildDots(cfg, art, grid) {
  const count = Math.max(2, Math.min(grid ? 64 : 30, cfg.segments));
  const wrap = document.createElement('div');
  wrap.className = grid ? 'tr-dots tr-dots-grid' : 'tr-dots';
  if (grid) {
    const cols = Math.ceil(Math.sqrt(count));
    wrap.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  }
  const dots = [];
  for (let i = 0; i < count; i++) {
    const d = document.createElement('span');
    d.className = 'tr-dot';
    wrap.appendChild(d);
    dots.push(d);
  }
  art.appendChild(wrap);
  let lastLit = -1;
  return (ctx) => {
    const lit = Math.ceil(ctx.p * count - 0.00001);
    if (lit === lastLit) return;
    lastLit = lit;
    for (let i = 0; i < count; i++) dots[i].classList.toggle('on', i < lit);
  };
}

function buildBlocks(cfg, art) {
  const count = Math.max(3, Math.min(24, cfg.segments));
  const wrap = document.createElement('div');
  wrap.className = 'tr-blocks';
  const blocks = [];
  for (let i = 0; i < count; i++) {
    const b = document.createElement('span');
    b.className = 'tr-block';
    wrap.appendChild(b);
    blocks.push(b);
  }
  art.appendChild(wrap);
  let lastLit = -1;
  return (ctx) => {
    const lit = Math.ceil(ctx.p * count - 0.00001);
    if (lit === lastLit) return;
    lastLit = lit;
    // Stack empties from the top down.
    for (let i = 0; i < count; i++) blocks[i].classList.toggle('on', count - i <= lit);
  };
}

function buildFlip(cfg, art) {
  const wrap = document.createElement('div');
  wrap.className = 'tr-flip';
  art.appendChild(wrap);
  let lastText = null;
  const cards = [];
  return (ctx) => {
    if (ctx.text === lastText) return;
    const chars = [...(ctx.text || '')];
    if (chars.length !== cards.length) {
      wrap.innerHTML = '';
      cards.length = 0;
      for (const ch of chars) {
        const card = document.createElement('span');
        card.className = ch === ':' || ch === '.' ? 'tr-flip-sep' : 'tr-flip-card';
        card.textContent = ch;
        wrap.appendChild(card);
        cards.push(card);
      }
    } else {
      for (let i = 0; i < chars.length; i++) {
        if (cards[i].textContent !== chars[i]) {
          cards[i].textContent = chars[i];
          cards[i].classList.remove('flipping');
          void cards[i].offsetWidth;
          cards[i].classList.add('flipping');
        }
      }
    }
    lastText = ctx.text;
  };
}

function buildPlain(cfg, art, variant) {
  const wrap = document.createElement('div');
  wrap.className = `tr-plain tr-plain-${variant}`;
  if (variant === 'lcd') {
    const ghost = document.createElement('span');
    ghost.className = 'tr-lcd-ghost';
    wrap.appendChild(ghost);
    art.appendChild(wrap);
    return (ctx) => {
      ghost.textContent = (ctx.text || '').replace(/[0-9]/g, '8');
    };
  }
  art.appendChild(wrap);
  return () => {};
}

function buildMatrix(cfg, art) {
  const wrap = document.createElement('div');
  wrap.className = 'tr-plain tr-plain-matrix';
  const a = document.createElement('span');
  a.className = 'tr-glitch tr-glitch-a';
  const b = document.createElement('span');
  b.className = 'tr-glitch tr-glitch-b';
  wrap.append(a, b);
  art.appendChild(wrap);
  return (ctx) => {
    if (a.textContent !== ctx.text) {
      a.textContent = ctx.text;
      b.textContent = ctx.text;
    }
    const jitter = ctx.phase === 'danger' ? 2.2 : 1;
    const dx = Math.sin(ctx.now / 90) * jitter;
    a.style.transform = `translate(${dx.toFixed(2)}px, 0)`;
    b.style.transform = `translate(${(-dx).toFixed(2)}px, 0)`;
  };
}

const BUILDERS = {
  'ring': (c, a) => buildRing(c, a, { head: false }),
  'ring-minute': buildRingMinute,
  'ring-dual': buildRingDual,
  'ring-segments': buildRingSegments,
  'ring-ticks': buildRingTicks,
  'ring-gradient': (c, a) => buildRing(c, a, { gradient: true }),
  'ring-neon': (c, a) => buildRing(c, a, { head: true }),
  'ring-dashed': (c, a) => buildRing(c, a, { dashed: true, square: true }),
  'ring-double-track': (c, a) => buildRingDual(c, a),
  'orbit': buildOrbit,
  'spiral': buildSpiral,
  'pie': buildPie,
  'gauge': buildGauge,
  'liquid': buildLiquid,
  'hourglass': buildHourglass,
  'radar': buildRadar,
  'analog': buildAnalog,
  'pulse': buildPulse,
  'bar-h': (c, a) => buildBar(c, a, false),
  'bar-v': (c, a) => buildBar(c, a, true),
  'bar-segments': (c, a) => buildBarSegments(c, a, false),
  'bar-stepped': (c, a) => buildBarSegments(c, a, true),
  'dots': (c, a) => buildDots(c, a, false),
  'dot-grid': (c, a) => buildDots(c, a, true),
  'blocks': buildBlocks,
  'digital': (c, a) => buildPlain(c, a, 'digital'),
  'lcd': (c, a) => buildPlain(c, a, 'lcd'),
  'flip': buildFlip,
  'matrix': buildMatrix,
  'minimal': (c, a) => buildPlain(c, a, 'minimal'),
};

// ---------------------------------------------------------------------------

export function frameSize(cfg) {
  if (CIRCULAR.has(cfg.style)) return { width: cfg.size, height: cfg.size };
  switch (cfg.style) {
    case 'bar-h':
      return { width: cfg.size, height: Math.max(cfg.thickness * 2, 14) };
    case 'bar-v':
      return { width: Math.max(cfg.thickness * 2, 14), height: cfg.size };
    case 'bar-segments':
    case 'bar-stepped':
      return { width: cfg.size, height: Math.max(cfg.thickness * 3, 22) };
    case 'dots':
      return { width: cfg.size, height: Math.max(cfg.thickness * 2.4, 14) };
    case 'dot-grid':
      return { width: cfg.size, height: cfg.size };
    case 'blocks':
      return { width: Math.max(cfg.thickness * 4, 26), height: cfg.size };
    default:
      return { width: 'auto', height: 'auto' };
  }
}

// Where the formatted time is drawn for each style.
const TEXT_HIDDEN = new Set(['flip', 'matrix']);
const TEXT_OUTSIDE = new Set([
  'bar-h', 'bar-v', 'bar-segments', 'bar-stepped', 'dots', 'blocks', 'hourglass', 'analog',
  'dot-grid',
]);

function textPlacement(style) {
  if (TEXT_HIDDEN.has(style)) return 'hidden';
  if (TEXT_OUTSIDE.has(style)) return 'outside';
  return 'inside';
}

export function createTimerView(cfg) {
  const root = document.createElement('div');
  root.className = 'timer';
  root.dataset.style = cfg.style;
  root.dataset.backdrop = cfg.backdrop;
  root.style.scale = String((cfg.scale || 100) / 100);
  if (cfg.pulse_on_danger) root.dataset.pulse = 'on';
  if (cfg.shake_on_danger) root.dataset.shake = 'on';

  const { width, height } = frameSize(cfg);
  const glowPx = (cfg.glow / 100) * Math.max(8, cfg.size * 0.12);

  root.style.setProperty('--tc', cfg.color);
  root.style.setProperty('--tc2', cfg.color2);
  root.style.setProperty('--track', rgba(cfg.track_color, cfg.track_opacity / 100));
  root.style.setProperty('--glow', `${glowPx.toFixed(1)}px`);
  root.style.setProperty('--radius', CIRCULAR.has(cfg.style) ? '50%' : `${cfg.corner_radius}px`);
  root.style.setProperty('--tw', typeof width === 'number' ? `${width}px` : width);
  root.style.setProperty('--th', typeof height === 'number' ? `${height}px` : height);
  root.style.setProperty('--tfont', FONT_MAP[cfg.font_family] || FONT_MAP.mono);
  root.style.setProperty('--tsize', `${Math.max(9, (cfg.size * cfg.font_size) / 100).toFixed(1)}px`);
  root.style.setProperty('--tweight', cfg.font_weight);
  root.style.setProperty('--ttext', cfg.text_color);
  root.style.setProperty('--tbackdrop', rgba(cfg.backdrop_color, cfg.backdrop_opacity / 100));
  root.style.opacity = String(cfg.opacity / 100);

  const frame = document.createElement('div');
  frame.className = 'timer-frame';

  if (cfg.image) {
    const media = document.createElement('div');
    media.className = 'timer-media';
    media.style.backgroundImage = `url("${cfg.image}")`;
    media.style.opacity = String(cfg.image_opacity / 100);
    if (cfg.image_blur) media.style.filter = `blur(${cfg.image_blur}px)`;
    frame.appendChild(media);
  }

  const art = document.createElement('div');
  art.className = 'timer-art';
  frame.appendChild(art);

  const placement = textPlacement(cfg.style);
  const textEl = document.createElement('div');
  textEl.className = `timer-text ${placement}`;
  if (cfg.text_format === 'none' || placement === 'hidden') textEl.classList.add('hidden');
  if (placement === 'inside') frame.appendChild(textEl);

  if (cfg.show_label && cfg.label && cfg.label_position === 'top') {
    const caption = document.createElement('div');
    caption.className = 'timer-caption top';
    caption.textContent = cfg.label;
    root.appendChild(caption);
  }

  root.appendChild(frame);
  if (placement !== 'inside') root.appendChild(textEl);

  if (cfg.show_label && cfg.label && cfg.label_position !== 'top') {
    const caption = document.createElement('div');
    caption.className = 'timer-caption bottom';
    caption.textContent = cfg.label;
    root.appendChild(caption);
  }

  const builder = BUILDERS[cfg.style] || BUILDERS.ring;
  const updateArt = builder(cfg, art);

  let lastText = null;
  let lastPhase = null;

  function update(ctx) {
    if (ctx.phase !== lastPhase) {
      lastPhase = ctx.phase;
      root.dataset.phase = ctx.phase;
      root.style.setProperty('--tc', ctx.color);
    }
    if (ctx.text !== lastText) {
      lastText = ctx.text;
      if (placement !== 'hidden') textEl.textContent = ctx.text;
    }
    updateArt(ctx);
  }

  return {
    el: root,
    frame,
    textEl,
    update,
    destroy() {
      root.remove();
    },
  };
}

export { CIRCULAR, escapeHtml, textPlacement };
