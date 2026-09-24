import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export const CHART_COLORS = {
  emerald: '#34d399',
  sky: '#38bdf8',
  amber: '#fbbf24',
  rose: '#fb7185',
  violet: '#a78bfa',
  slate: '#64748b',
};

const AXIS = { stroke: '#475569', fontSize: 10, tickLine: false, axisLine: false } as const;
const TOOLTIP_STYLE = {
  contentStyle: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#e2e8f0' },
};

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
  /** Stack areas/bars together instead of overlaying. */
  stack?: boolean;
}

/**
 * Expands sparse DB rows into a continuous grid covering the whole window so charts
 * show "no activity" as zero instead of interpolating across missing buckets.
 * Non-count fields (e.g. latency) stay undefined in empty buckets, leaving a gap.
 */
export function fillBuckets(rows: any[], stepMs: number, windowMs: number, zeroKeys: string[], xKey = 'ts'): any[] {
  const now = Date.now();
  const end = Math.floor(now / stepMs) * stepMs;
  const start = Math.floor((now - windowMs) / stepMs) * stepMs;
  const byTs = new Map<number, any>(rows.map((r) => [new Date(r[xKey]).getTime(), r]));
  const grid: number[] = [];
  for (let t = start; t <= end; t += stepMs) grid.push(t);
  const gridSet = new Set(grid);
  // If the server buckets on a different alignment than assumed, show the raw rows rather than dropping data.
  if (rows.some((r) => !gridSet.has(new Date(r[xKey]).getTime()))) return rows;
  return grid.map(
    (t) => byTs.get(t) ?? { [xKey]: new Date(t).toISOString(), ...Object.fromEntries(zeroKeys.map((k) => [k, 0])) },
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
  className = '',
  heightClass = 'h-56',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  heightClass?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900 p-4 ${className}`}>
      <div className="mb-3">
        <h2 className="text-sm font-bold text-slate-200">{title}</h2>
        {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      <div className={heightClass}>{children}</div>
    </div>
  );
}

export function EmptyChart() {
  return <div className="flex h-full items-center justify-center text-xs text-slate-500">No data in this window yet.</div>;
}

const isEmpty = (data: unknown[]) => !data || data.length === 0;

function tickFormatter(bucket: 'hour' | 'day' | 'minute') {
  return (v: string | number) => {
    const d = new Date(v);
    return bucket === 'day'
      ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
}

function labelFormatter(label: unknown) {
  return new Date(label as string).toLocaleString();
}

export function TimeAreaChart({
  data,
  xKey = 'ts',
  series,
  bucket = 'hour',
}: {
  data: any[];
  xKey?: string;
  series: SeriesDef[];
  bucket?: 'hour' | 'day' | 'minute';
}) {
  if (isEmpty(data)) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis dataKey={xKey} tickFormatter={tickFormatter(bucket)} {...AXIS} minTickGap={32} />
        <YAxis {...AXIS} allowDecimals={false} />
        <Tooltip {...TOOLTIP_STYLE} labelFormatter={labelFormatter} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s) => (
          <Area
            isAnimationActive={false}
            key={s.key}
            type="linear"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#grad-${s.key})`}
            stackId={s.stack ? 'stack' : undefined}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TimeLineChart({
  data,
  xKey = 'ts',
  series,
  bucket = 'hour',
  unit = '',
}: {
  data: any[];
  xKey?: string;
  series: SeriesDef[];
  bucket?: 'hour' | 'day' | 'minute';
  unit?: string;
}) {
  if (isEmpty(data)) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis dataKey={xKey} tickFormatter={tickFormatter(bucket)} {...AXIS} minTickGap={32} />
        <YAxis {...AXIS} unit={unit} />
        <Tooltip {...TOOLTIP_STYLE} labelFormatter={labelFormatter} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s) => (
          <Line isAnimationActive={false} key={s.key} type="linear" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TimeBarChart({
  data,
  xKey = 'ts',
  series,
  bucket = 'hour',
}: {
  data: any[];
  xKey?: string;
  series: SeriesDef[];
  bucket?: 'hour' | 'day' | 'minute';
}) {
  if (isEmpty(data)) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="#1e293b" vertical={false} />
        <XAxis dataKey={xKey} tickFormatter={tickFormatter(bucket)} {...AXIS} minTickGap={32} />
        <YAxis {...AXIS} allowDecimals={false} />
        <Tooltip {...TOOLTIP_STYLE} labelFormatter={labelFormatter} cursor={{ fill: '#1e293b' }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {series.map((s) => (
          <Bar isAnimationActive={false} key={s.key} dataKey={s.key} name={s.label} fill={s.color} stackId={s.stack ? 'stack' : undefined} radius={s.stack ? 0 : [3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, colors }: { data: { name: string; value: number }[]; colors: string[] }) {
  if (isEmpty(data) || data.every((d) => d.value === 0)) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="none">
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBarChart({
  data,
  nameKey,
  valueKey,
  color,
  unit = '',
}: {
  data: any[];
  nameKey: string;
  valueKey: string;
  color: string;
  unit?: string;
}) {
  if (isEmpty(data)) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="#1e293b" horizontal={false} />
        <XAxis type="number" {...AXIS} unit={unit} />
        <YAxis type="category" dataKey={nameKey} width={230} interval={0} tickFormatter={(v: string) => (v.length > 38 ? `…${v.slice(-37)}` : v)} {...AXIS} />
        <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: '#1e293b' }} />
        <Bar isAnimationActive={false} dataKey={valueKey} fill={color} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
