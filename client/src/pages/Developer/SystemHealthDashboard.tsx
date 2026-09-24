import React, { useEffect, useState } from 'react';
import { Cpu, MemoryStick, Timer, ServerCrash, MonitorX, Gauge } from 'lucide-react';
import { observabilityService } from '../../services/observability.service';
import {
  CHART_COLORS,
  ChartCard,
  DonutChart,
  fillBuckets,
  HorizontalBarChart,
  TimeAreaChart,
  TimeBarChart,
  TimeLineChart,
} from '../../components/developer/charts';

const RANGES = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '3d', hours: 72 },
  { label: '7d', hours: 168 },
];

interface RequestPoint {
  ts: string;
  requests: number;
  serverErrors: number;
  clientErrors: number;
  avgMs: number;
  p95Ms: number;
  activeUsers: number;
}

interface ErrorPoint {
  ts: string;
  backendErrors: number;
  backendWarnings: number;
  browserErrors: number;
}

interface RequestOverview {
  windowDays: number;
  totalRequests: number;
  avgLatencyMs: number;
  serverErrorCount: number;
  slowestRequests: { method: string; path: string; statusCode: number; durationMs: number; createdAt: string }[];
}

interface RouteRow {
  method: string;
  path: string;
  requests: number;
  avgLatencyMs: number;
  errorCount: number;
}

interface MetricSnapshot {
  cpuLoadAvg1m: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  processRssMb: number;
  eventLoopLagMs: number;
  uptimeSec: number;
  createdAt: string;
}

interface BackendErrorRow {
  id: string;
  createdAt: string;
  source: string;
  message: string;
}

interface ClientErrorRow {
  id: string;
  createdAt: string;
  message: string;
  url: string | null;
  userAgent: string | null;
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: React.ReactNode; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wide">
        <Icon className={`h-4 w-4 ${accent}`} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-slate-50">{value}</div>
    </div>
  );
}

function formatUptime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

export const SystemHealthDashboard: React.FC = () => {
  const [overview, setOverview] = useState<RequestOverview | null>(null);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [metrics, setMetrics] = useState<{
    instances: string[];
    instance: string | null;
    latest: MetricSnapshot | null;
    history: MetricSnapshot[];
  }>({ instances: [], instance: null, latest: null, history: [] });
  const [instance, setInstance] = useState<string | undefined>(undefined);
  const [backendErrors, setBackendErrors] = useState<BackendErrorRow[]>([]);
  const [clientErrors, setClientErrors] = useState<ClientErrorRow[]>([]);
  const [hours, setHours] = useState(24);
  const [reqSeries, setReqSeries] = useState<RequestPoint[]>([]);
  const [statusMix, setStatusMix] = useState<{ name: string; value: number }[]>([]);
  const [errSeries, setErrSeries] = useState<ErrorPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const days = Math.max(1, Math.ceil(hours / 24));
  const reqBucket: 'hour' | 'minute' = hours > 48 ? 'hour' : 'minute';

  const load = async () => {
    setLoading(true);
    try {
      const [ov, rt, mt, be, ce, rs, sm, es] = await Promise.all([
        observabilityService.getRequestOverview(days),
        observabilityService.getRequestsByRoute(days),
        observabilityService.getMetrics(hours, instance),
        observabilityService.getBackendErrors(50),
        observabilityService.getClientErrors(50),
        observabilityService.getRequestTimeseries(hours),
        observabilityService.getStatusDistribution(days),
        observabilityService.getErrorTimeseries(days),
      ]);
      setReqSeries(
        fillBuckets(rs, hours > 48 ? 3_600_000 : 600_000, hours * 3_600_000, ['requests', 'serverErrors', 'clientErrors', 'activeUsers']),
      );
      setStatusMix(sm);
      setErrSeries(fillBuckets(es, 3_600_000, days * 86_400_000, ['backendErrors', 'backendWarnings', 'browserErrors']));
      setOverview(ov);
      setRoutes(rt);
      setMetrics(mt);
      setBackendErrors(be);
      setClientErrors(ce);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [hours, instance]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-slate-50">System Health &amp; Load</h1>
        <div className="flex items-center gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.hours}
              onClick={() => setHours(r.hours)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                hours === r.hours ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !overview ? (
        <div className="text-slate-500 text-sm">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard icon={Gauge} label="Requests" value={overview?.totalRequests ?? '—'} accent="text-sky-400" />
            <StatCard icon={Timer} label="Avg Latency" value={`${overview?.avgLatencyMs ?? 0} ms`} accent="text-violet-400" />
            <StatCard icon={ServerCrash} label="5xx Errors" value={overview?.serverErrorCount ?? 0} accent="text-rose-400" />
            <StatCard
              icon={Cpu}
              label="Load Avg (1m)"
              value={metrics.latest ? metrics.latest.cpuLoadAvg1m.toFixed(2) : '—'}
              accent="text-amber-400"
            />
            <StatCard
              icon={MemoryStick}
              label="Memory"
              value={metrics.latest ? `${(metrics.latest.memoryUsedMb / 1024).toFixed(1)} / ${(metrics.latest.memoryTotalMb / 1024).toFixed(1)} GB` : '—'}
              accent="text-emerald-400"
            />
          </div>

          {metrics.instances.length > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Server instance:</span>
              <select
                value={metrics.instance ?? ''}
                onChange={(e) => setInstance(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
              >
                {metrics.instances.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          )}

          {metrics.latest && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 flex flex-wrap gap-6 text-xs">
              <div><span className="text-slate-500">Process RSS: </span><span className="text-slate-200 font-semibold">{metrics.latest.processRssMb} MB</span></div>
              <div><span className="text-slate-500">Event Loop Lag: </span><span className="text-slate-200 font-semibold">{metrics.latest.eventLoopLagMs.toFixed(2)} ms</span></div>
              <div><span className="text-slate-500">Uptime: </span><span className="text-slate-200 font-semibold">{formatUptime(metrics.latest.uptimeSec)}</span></div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Request Volume" subtitle="Requests per interval">
              <TimeAreaChart data={reqSeries} bucket={reqBucket} series={[{ key: 'requests', label: 'Requests', color: CHART_COLORS.sky }]} />
            </ChartCard>
            <ChartCard title="Response Time" subtitle="Average and 95th percentile (ms)">
              <TimeLineChart
                data={reqSeries}
                bucket={reqBucket}
                unit="ms"
                series={[
                  { key: 'avgMs', label: 'Average', color: CHART_COLORS.emerald },
                  { key: 'p95Ms', label: 'p95', color: CHART_COLORS.amber },
                ]}
              />
            </ChartCard>
            <ChartCard title="HTTP Errors" subtitle="4xx (client) and 5xx (server) responses">
              <TimeBarChart
                data={reqSeries}
                bucket={reqBucket}
                series={[
                  { key: 'clientErrors', label: '4xx', color: CHART_COLORS.amber, stack: true },
                  { key: 'serverErrors', label: '5xx', color: CHART_COLORS.rose, stack: true },
                ]}
              />
            </ChartCard>
            <ChartCard title="Response Status Mix" subtitle="Share of responses by status class">
              <DonutChart
                data={statusMix}
                colors={[CHART_COLORS.emerald, CHART_COLORS.sky, CHART_COLORS.amber, CHART_COLORS.rose]}
              />
            </ChartCard>
            <ChartCard title="Logged Errors &amp; Warnings" subtitle="Backend logs and browser crashes per hour">
              <TimeBarChart
                data={errSeries}
                bucket="hour"
                series={[
                  { key: 'backendErrors', label: 'Backend errors', color: CHART_COLORS.rose, stack: true },
                  { key: 'browserErrors', label: 'Browser errors', color: CHART_COLORS.violet, stack: true },
                  { key: 'backendWarnings', label: 'Warnings', color: CHART_COLORS.amber, stack: true },
                ]}
              />
            </ChartCard>
            <ChartCard title="Active Users (API)" subtitle="Distinct logged-in users making requests">
              <TimeLineChart data={reqSeries} bucket={reqBucket} series={[{ key: 'activeUsers', label: 'Users', color: CHART_COLORS.sky }]} />
            </ChartCard>
            <ChartCard title="CPU Load Average (1m)" subtitle="Host load average">
              <TimeLineChart data={metrics.history} xKey="createdAt" bucket="minute" series={[{ key: 'cpuLoadAvg1m', label: 'Load', color: CHART_COLORS.amber }]} />
            </ChartCard>
            <ChartCard title="Memory" subtitle="Host memory used and API process RSS (MB)">
              <TimeAreaChart
                data={metrics.history}
                xKey="createdAt"
                bucket="minute"
                series={[
                  { key: 'memoryUsedMb', label: 'Host used', color: CHART_COLORS.emerald },
                  { key: 'processRssMb', label: 'API process', color: CHART_COLORS.violet },
                ]}
              />
            </ChartCard>
            <ChartCard title="Event Loop Lag" subtitle="Node.js responsiveness (ms) — rising means the server is saturated">
              <TimeLineChart data={metrics.history} xKey="createdAt" bucket="minute" unit="ms" series={[{ key: 'eventLoopLagMs', label: 'Lag', color: CHART_COLORS.rose }]} />
            </ChartCard>
            <ChartCard title="Slowest Routes" subtitle="Average latency (ms), top 10" heightClass="h-80">
              <HorizontalBarChart
                data={[...routes].sort((a, b) => b.avgLatencyMs - a.avgLatencyMs).slice(0, 10).map((r) => ({ name: `${r.method} ${r.path.replace(/^\/api/, '')}`, ms: r.avgLatencyMs }))}
                nameKey="name"
                valueKey="ms"
                color={CHART_COLORS.violet}
                unit="ms"
              />
            </ChartCard>
            <ChartCard title="Busiest Routes" subtitle="Request count, top 10" className="lg:col-span-2" heightClass="h-80">
              <HorizontalBarChart
                data={routes.slice(0, 10).map((r) => ({ name: `${r.method} ${r.path.replace(/^\/api/, '')}`, requests: r.requests }))}
                nameKey="name"
                valueKey="requests"
                color={CHART_COLORS.sky}
              />
            </ChartCard>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-sm font-bold text-slate-200 mb-3">Requests by Route</h2>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 uppercase tracking-wide sticky top-0 bg-slate-900">
                    <th className="py-1.5 pr-4">Route</th>
                    <th className="py-1.5 pr-4">Requests</th>
                    <th className="py-1.5 pr-4">Avg Latency</th>
                    <th className="py-1.5 pr-4">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((r) => (
                    <tr key={`${r.method} ${r.path}`} className="border-t border-slate-800">
                      <td className="py-1.5 pr-4 text-slate-200">
                        <span className="text-slate-500 mr-1">{r.method}</span>{r.path}
                      </td>
                      <td className="py-1.5 pr-4 text-slate-400">{r.requests}</td>
                      <td className="py-1.5 pr-4 text-slate-400">{r.avgLatencyMs} ms</td>
                      <td className={`py-1.5 pr-4 font-semibold ${r.errorCount > 0 ? 'text-rose-400' : 'text-slate-500'}`}>{r.errorCount}</td>
                    </tr>
                  ))}
                  {routes.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-slate-500">No requests recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                <ServerCrash className="h-4 w-4 text-rose-400" /> Backend Errors
              </h2>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {backendErrors.map((e) => (
                  <div key={e.id} className="text-xs border-b border-slate-800/60 pb-1.5">
                    <div className="text-slate-500">{new Date(e.createdAt).toLocaleString()} · <span className="text-slate-400">{e.source}</span></div>
                    <div className="text-rose-300 truncate">{e.message}</div>
                  </div>
                ))}
                {backendErrors.length === 0 && <p className="text-xs text-slate-500">No backend errors recorded.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                <MonitorX className="h-4 w-4 text-amber-400" /> Frontend (Browser) Errors
              </h2>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {clientErrors.map((e) => (
                  <div key={e.id} className="text-xs border-b border-slate-800/60 pb-1.5">
                    <div className="text-slate-500">{new Date(e.createdAt).toLocaleString()} · <span className="text-slate-400 truncate">{e.url}</span></div>
                    <div className="text-amber-300 truncate">{e.message}</div>
                  </div>
                ))}
                {clientErrors.length === 0 && <p className="text-xs text-slate-500">No frontend errors recorded.</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
