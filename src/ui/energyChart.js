// The energy chart, drawn by hand as SVG (no chart library).
//   blue line + dots – the daily usage the dossier reports
//   dark bars        – the usage the meter actually recorded (after analysis)
//   red marker rings – anything the detector flagged (after analysis)
// Shapes are positioned with plain sums: each day gets an equal-width
// "band" across the chart, and kWh is turned into a height by a scale.

import { linearScale, logScale } from '../lib/scale.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WIDTH = 720;
const HEIGHT = 360;
const PAD = { top: 34, right: 22, bottom: 54, left: 64 };

// Make an SVG element: svg('rect', { x: 0, y: 0 }, child, child...)
function svg(tag, attributes = {}, ...children) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== null && value !== undefined) element.setAttribute(name, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

const format = (value) => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });

// analysis – the result of analyseEnergy()
// options.analysed – false before the agent runs the analysis (reported line only)
// options.scale    – 'linear' or 'log'
// options.reveal   – true to animate the bars growing (only the first time)
export function renderEnergyChart(analysis, { analysed, scale: scaleName, reveal = false }) {
  const days = analysis.days;
  const left = PAD.left;
  const right = WIDTH - PAD.right;
  const top = PAD.top;
  const bottom = HEIGHT - PAD.bottom;

  // Horizontal: one band per day; centre(i) is the middle of day i's band.
  const band = (right - left) / days.length;
  const centre = (index) => left + band * index + band / 2;

  // Vertical: the scale turns kWh into a y position.
  const values = days.flatMap((day) => [day.reportedUsage, day.metered]).filter(Number.isFinite);
  const max = Math.max(...values);
  const scale = scaleName === 'log' ? logScale(max, top, bottom) : linearScale(max, top, bottom);
  const y = scale.toY;

  const chart = svg('svg', {
    class: `chart${reveal ? ' chart--reveal' : ''}`,
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    role: 'img',
    'aria-labelledby': 'chart-title chart-desc',
  });

  chart.append(
    svg('title', { id: 'chart-title' }, 'Daily electricity use, Wenoti Arcade, 13 to 26 October 2026'),
    svg('desc', { id: 'chart-desc' }, describe(analysis, analysed, scaleName)),

    // Graph paper behind the plot
    svg('defs', {},
      svg('pattern', { id: 'graph-paper', width: 12, height: 12, patternUnits: 'userSpaceOnUse' },
        svg('path', { d: 'M 12 0 L 0 0 0 12', class: 'chart__paper-line' }))),
    svg('rect', { x: left, y: top, width: right - left, height: bottom - top, fill: 'url(#graph-paper)' }),
  );

  // Days the dossier highlights in yellow (Oct 25 and 26)
  days.forEach((day, index) => {
    if (day.highlighted) {
      chart.append(svg('rect', {
        class: 'chart__highlight', x: left + band * index, y: top, width: band, height: bottom - top,
      }));
    }
  });

  // Horizontal grid lines with kWh labels on the left
  for (const tick of scale.ticks) {
    chart.append(
      svg('line', { class: 'chart__grid', x1: left, x2: right, y1: y(tick), y2: y(tick) }),
      svg('text', { class: 'chart__tick', x: left - 8, y: y(tick) + 4, 'text-anchor': 'end' }, format(tick)),
    );
  }
  chart.append(
    svg('text', { class: 'chart__unit', x: 8, y: top - 14 }, scaleName === 'log' ? 'kWh (log scale)' : 'kWh'),
    svg('line', { class: 'chart__axis', x1: left, x2: right, y1: bottom, y2: bottom }),
    svg('line', { class: 'chart__axis', x1: left, x2: left, y1: top, y2: bottom }),
  );

  // Day numbers along the bottom
  days.forEach((day, index) => {
    chart.append(svg('text', { class: 'chart__tick', x: centre(index), y: bottom + 18, 'text-anchor': 'middle' },
      day.label.replace(/^\D+/, ''))); // "Oct 13" -> "13"
  });
  chart.append(svg('text', { class: 'chart__unit', x: left, y: bottom + 40 }, 'October 2026'));

  // Metered usage bars (only once the meter differences have been worked out)
  if (analysed) {
    days.forEach((day, index) => {
      if (day.metered === null) {
        chart.append(svg('text', { class: 'chart__na', x: centre(index), y: bottom - 16, 'text-anchor': 'middle' }, 'n/a'));
        return;
      }
      chart.append(svg('rect', {
        class: 'chart__bar',
        style: `--i: ${index}`,
        x: centre(index) - band * 0.22,
        y: y(day.metered),
        width: band * 0.44,
        height: bottom - y(day.metered),
      }));
    });
  }

  // Reported usage: a line joining a dot for each day
  const points = days.map((day, index) => [centre(index), y(day.reportedUsage)]);
  chart.append(
    svg('polyline', { class: 'chart__reported', points: points.map((point) => point.join(',')).join(' ') }),
    ...points.map(([cx, cy]) => svg('circle', { class: 'chart__dot', cx, cy, r: 3.5 })),
  );

  // Red rings and labels around whatever the detector flagged
  if (analysed) {
    for (const day of analysis.surges) {
      const index = days.indexOf(day);
      chart.append(ring(centre(index), y(day.metered), band));
      chart.append(label(centre(index) - band * 0.75, y(day.metered) + 4, 'left', ['SURGE', `${format(day.metered)} kWh`]));
    }
    for (const day of analysis.mismatches) {
      const index = days.indexOf(day);
      const x = centre(index) + band * 0.34;
      const yReported = y(day.reportedUsage);
      const yMetered = y(day.metered);
      chart.append(
        ring(centre(index), yReported, band),
        // a bracket from the reported figure down to the metered one
        svg('path', { class: 'chart__bracket', d: `M ${x - 5} ${yReported} H ${x} V ${yMetered} H ${x - 5}` }),
        label(x + 8, (yReported + yMetered) / 2, 'right', ['MISMATCH', `${day.gap > 0 ? '+' : ''}${format(day.gap)} kWh`]),
      );
    }
  }

  return chart;
}

// Two slightly different ellipses look like a ring drawn with a marker pen.
function ring(cx, cy, band) {
  return svg('g', { class: 'chart__ring' },
    svg('ellipse', { cx, cy, rx: band * 0.6, ry: 15, transform: `rotate(-8 ${cx} ${cy})` }),
    svg('ellipse', { cx: cx + 1, cy: cy - 1, rx: band * 0.64, ry: 13, transform: `rotate(-3 ${cx} ${cy})` }));
}

// A two-line red label. side 'left' means the text ends at x; 'right'
// means it starts at x. If that side has no room, it flips to the other.
const LABEL_ROOM = 80; // roughly how wide a label is ("+472.5 kWh" is about 70)
function label(x, cy, side, lines) {
  let onLeft = side === 'left';
  if (onLeft && x - LABEL_ROOM < PAD.left) onLeft = false;
  if (!onLeft && x + LABEL_ROOM > WIDTH - PAD.right) onLeft = true;
  return svg('text', { class: 'chart__label', x, y: cy, 'text-anchor': onLeft ? 'end' : 'start' },
    lines.map((line, index) => svg('tspan', { x, dy: index === 0 ? 0 : 14 }, line)));
}

// A sentence describing the chart, for screen readers.
function describe(analysis, analysed, scaleName) {
  const parts = [`Reported daily usage for each day, on a ${scaleName === 'log' ? 'logarithmic' : 'linear'} scale.`];
  if (analysed) {
    parts.push('Bars show the usage worked out from the meter readings.');
    for (const day of analysis.surges) parts.push(`Surge flagged on ${day.label}: ${format(day.metered)} kWh metered.`);
    for (const day of analysis.mismatches) {
      parts.push(`Mismatch flagged on ${day.label}: ${format(day.reportedUsage)} kWh reported, ${format(day.metered)} kWh metered.`);
    }
  }
  return parts.join(' ');
}
