// Maths for the chart's vertical axis: turning kWh into a height on screen,
// and choosing round numbers for the axis labels.

// A "nice" step between axis labels (1, 2, 2.5 or 5 times a power of ten)
// that gives about `count` labels from 0 up to max.
export function niceStep(max, count = 6) {
  if (!(max > 0)) return 1;
  const rough = max / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough);
  return step;
}

// Linear scale: equal steps in kWh are equal distances on screen.
// Returns { ticks, toY(value) } where toY gives a y position between
// `bottom` (for 0) and `top` (for the highest tick).
export function linearScale(max, top, bottom) {
  const step = niceStep(max);
  const highest = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let value = 0; value <= highest + step / 2; value += step) ticks.push(value);
  return {
    ticks,
    toY: (value) => bottom - (Math.max(0, value) / highest) * (bottom - top),
  };
}

// Log scale: each power of ten (10, 100, 1000...) is the same distance
// apart. Small and huge values both stay readable on one chart.
export function logScale(max, top, bottom, floor = 10) {
  const lowPower = Math.log10(floor);
  const highPower = Math.max(lowPower + 1, Math.ceil(Math.log10(Math.max(max, floor))));
  const ticks = [];
  for (let power = lowPower; power <= highPower; power += 1) ticks.push(10 ** power);
  return {
    ticks,
    toY: (value) => {
      const power = Math.log10(Math.max(value, floor)); // anything below the floor sits on the floor
      return bottom - ((power - lowPower) / (highPower - lowPower)) * (bottom - top);
    },
  };
}
