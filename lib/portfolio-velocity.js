function computeVelocity(seriesByYear, currentYear) {
  const c0 = seriesByYear.get(currentYear) || 0;
  const c1 = seriesByYear.get(currentYear - 1) || 0;
  const c2 = seriesByYear.get(currentYear - 2) || 0;
  return (c0 * 3 + c1 * 2 + c2 * 1) / 6;
}

function yearFraction(now) {
  const start = new Date(now.getFullYear(), 0, 1).getTime();
  const end = new Date(now.getFullYear() + 1, 0, 1).getTime();
  return (now.getTime() - start) / (end - start);
}

function linearRegression(points) {
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0, den = 0;
  for (const p of points) { num += (p.x - meanX) * (p.y - meanY); den += (p.x - meanX) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX, meanY };
}

function trendFromSlope(slope, meanY) {
  if (meanY === 0) return "flat";
  const ratio = slope / meanY;
  if (ratio > 0.1) return "rising";
  if (ratio < -0.1) return "falling";
  return "flat";
}

function buildVelocitySeries(rawByYear, currentYear, now, forecastYears = 3) {
  const span = 5;
  const fraction = Math.max(0.05, yearFraction(now));
  const series = [];
  for (let y = currentYear - span + 1; y <= currentYear; y++) {
    const total = rawByYear.get(y) || 0;
    const partial = y === currentYear && fraction < 1;
    const projected = partial ? Math.round(total / fraction) : total;
    series.push({ year: y, total, projected, partial });
  }
  const { slope, intercept, meanY } = linearRegression(series.map(p => ({ x: p.year, y: p.projected })));
  const forecast = [];
  for (let i = 1; i <= forecastYears; i++) {
    const y = currentYear + i;
    forecast.push({ year: y, total: Math.max(0, Math.round(slope * y + intercept)) });
  }
  return { series, forecast, trend: trendFromSlope(slope, meanY) };
}

module.exports = { computeVelocity, buildVelocitySeries };
