import React, { useRef, useState } from 'react';
import { useElementWidth } from './useElementWidth';
import { formatNumber, formatPercent } from '../../features/platformAdmin/format';

const HEIGHT = 232;
const MARGIN = { top: 22, right: 8, bottom: 30, left: 36 };

/** Clean integer ticks (0, 1, 2 … or 0, 5, 10 …) with headroom above the max. */
function niceTicks(max) {
  if (max <= 4) {
    const top = Math.max(1, max);
    return { top, ticks: Array.from({ length: top + 1 }, (_, index) => index) };
  }
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map(factor => factor * power).find(candidate => candidate >= rough);
  const top = Math.ceil(max / step) * step;
  return { top, ticks: Array.from({ length: top / step + 1 }, (_, index) => index * step) };
}

/** Bar with a 4px rounded data end and a square baseline. */
function columnPath(x, y, width, height) {
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

const bucketLabel = (bucket, unit, long = false) => {
  const date = new Date(bucket.start);
  if (unit === 'month') return date.toLocaleDateString(undefined, long ? { month: 'long', year: 'numeric' } : { month: 'short' });
  return date.toLocaleDateString(undefined, long ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric' });
};

export function SignupChart({ series, unit }) {
  const containerRef = useRef(null);
  const width = useElementWidth(containerRef, 640);
  const [hovered, setHovered] = useState(null);

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const max = series.reduce((highest, bucket) => Math.max(highest, bucket.signups), 0);
  const { top, ticks } = niceTicks(max);
  const band = series.length ? innerWidth / series.length : 0;
  // Bars stay thin (<= 24px) and never touch: at least a 2px gap per band.
  const barWidth = Math.max(1, Math.min(24, band - 2));
  const y = value => MARGIN.top + innerHeight - (value / top) * innerHeight;
  const labelEvery = Math.max(1, Math.ceil(series.length / Math.max(2, Math.floor(innerWidth / 72))));
  const peakIndex = max > 0 ? series.findIndex(bucket => bucket.signups === max) : -1;
  const active = hovered !== null ? series[hovered] : null;

  return (
    <div className="padm-chart" ref={containerRef}>
      <svg width={width} height={HEIGHT} role="img" aria-label="New accounts per period" className="padm-chart-svg">
        {ticks.map(tick => (
          <g key={tick}>
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} className="padm-grid-line" />
            <text x={MARGIN.left - 8} y={y(tick)} className="padm-axis-text" textAnchor="end" dominantBaseline="middle">
              {formatNumber(tick)}
            </text>
          </g>
        ))}
        {series.map((bucket, index) => {
          const x = MARGIN.left + index * band + (band - barWidth) / 2;
          const barHeight = MARGIN.top + innerHeight - y(bucket.signups);
          return (
            <g key={bucket.start}>
              {bucket.signups > 0 && (
                <path
                  d={columnPath(x, y(bucket.signups), barWidth, barHeight)}
                  className={`padm-column ${hovered === index ? 'is-hovered' : ''} ${hovered !== null && hovered !== index ? 'is-dimmed' : ''}`}
                />
              )}
              {index === peakIndex && hovered === null && (
                <text x={x + barWidth / 2} y={y(bucket.signups) - 6} className="padm-value-text" textAnchor="middle">
                  {formatNumber(bucket.signups)}
                </text>
              )}
              {index % labelEvery === 0 && (
                <text x={MARGIN.left + index * band + band / 2} y={HEIGHT - 10} className="padm-axis-text" textAnchor="middle">
                  {bucketLabel(bucket, unit)}
                </text>
              )}
              {/* Hit target: the whole band, taller and wider than the bar. */}
              <rect
                x={MARGIN.left + index * band}
                y={MARGIN.top}
                width={Math.max(band, 1)}
                height={innerHeight}
                className="padm-hit"
                tabIndex={0}
                aria-label={`${bucketLabel(bucket, unit, true)}: ${bucket.signups} new ${bucket.signups === 1 ? 'account' : 'accounts'}`}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
              />
            </g>
          );
        })}
        <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(0)} y2={y(0)} className="padm-baseline" />
      </svg>
      {active && (
        <div
          className="padm-tooltip"
          style={{ left: Math.min(Math.max(MARGIN.left + hovered * band + band / 2, 70), Math.max(70, width - 70)), top: Math.max(0, y(active.signups) - 58) }}
          aria-hidden="true"
        >
          <strong>{formatNumber(active.signups)}</strong>
          <span>{active.signups === 1 ? 'new account' : 'new accounts'} · {bucketLabel(active, unit, true)}</span>
        </div>
      )}
      <table className="padm-sr-only">
        <caption>New accounts per {unit}</caption>
        <thead><tr><th scope="col">Period</th><th scope="col">New accounts</th></tr></thead>
        <tbody>
          {series.map(bucket => (
            <tr key={bucket.start}><td>{bucketLabel(bucket, unit, true)}</td><td>{bucket.signups}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Ordered recency groups as labeled horizontal bars; "never" is de-emphasized. */
export function RecencyChart({ buckets }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const max = buckets.reduce((highest, bucket) => Math.max(highest, bucket.count), 0);
  return (
    <ul className="padm-hbars" aria-label="Accounts by when they were last seen">
      {buckets.map(bucket => (
        <li key={bucket.id} className="padm-hbar-row" title={`${bucket.label}: ${bucket.count} (${formatPercent(total ? bucket.count / total : 0)})`}>
          <span className="padm-hbar-label">{bucket.label}</span>
          <span className="padm-hbar-track">
            <span
              className={`padm-hbar-fill ${bucket.id === 'never' ? 'is-muted' : ''}`}
              style={{ width: max ? `${Math.max(bucket.count ? 2 : 0, (bucket.count / max) * 100)}%` : '0%' }}
            />
          </span>
          <span className="padm-hbar-value">
            {formatNumber(bucket.count)}
            <span className="padm-hbar-share"> · {formatPercent(total ? bucket.count / total : 0)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
