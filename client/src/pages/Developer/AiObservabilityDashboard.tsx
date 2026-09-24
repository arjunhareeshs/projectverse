import React, { useEffect, useState } from 'react';
import { Activity, Users, Coins, AlertTriangle, Clock } from 'lucide-react';
import { aiObservabilityService } from '../../services/aiObservability.service';
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

interface TimeseriesPoint {
  ts: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  groqTokens: number;
  nvidiaTokens: number;
  failures: number;
  fallbacks: number;
  activeUsers: number;
  avgLatencyMs: number;
}

interface Overview {
  windowDays: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  activeAiUsers: number;
  byStatus: { status: string; count: number }[];
  byProvider: { provider: string; count: number; totalTokens: number }[];
}

interface UserUsageRow {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  requests: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  lastUsedAt: string | null;
}

interface UsageLogRow {
  id: string;
  createdAt: string;
  userEmail: string;
  userFullName: string;
  provider: string;
  model: string | null;
  status: string;
  errorCode: string | null;
  totalTokens: number | null;
  latencyMs: number | null;
}

interface SystemLogRow {
  id: string;
  createdAt: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  source: string;
  message: string;
  userId: string | null;
}

const DAYS_OPTIONS = [1, 7, 30, 90];

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

export const AiObservabilityDashboard: React.FC = () => {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserUsageRow[]>([]);
  const [logs, setLogs] = useState<UsageLogRow[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLogRow[]>([]);
  const [series, setSeries] = useState<TimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const bucket: 'hour' | 'day' = days <= 7 ? 'hour' : 'day';

  const load = async () => {
    setLoading(true);
    try {
      const [ov, us, lg, sl, ts] = await Promise.all([
        aiObservabilityService.getOverview(days),
        aiObservabilityService.getUsersByUsage(days, 20),
        aiObservabilityService.getRecentLogs(50),
        aiObservabilityService.getSystemLogs({ limit: 50 }),
        aiObservabilityService.getTimeseries(days, bucket),
      ]);
      setSeries(
        fillBuckets(
          ts,
          bucket === 'hour' ? 3_600_000 : 86_400_000,
          days * 86_400_000,
          ['requests', 'inputTokens', 'outputTokens', 'totalTokens', 'groqTokens', 'nvidiaTokens', 'failures', 'fallbacks', 'activeUsers'],
        ),
      );
      setOverview(ov);
      setUsers(us);
      setLogs(lg);
      setSystemLogs(sl);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [days]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-slate-50">AI Usage &amp; System Monitoring</h1>
        <div className="flex items-center gap-1.5">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                days === d ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading && !overview ? (
        <div className="text-slate-500 text-sm">Loading...</div>
      ) : overview ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard icon={Users} label="Active AI Users" value={overview.activeAiUsers} accent="text-emerald-400" />
            <StatCard icon={Activity} label="Requests" value={overview.totalRequests} accent="text-sky-400" />
            <StatCard icon={Coins} label="Total Tokens" value={overview.totalTokens.toLocaleString()} accent="text-amber-400" />
            <StatCard icon={Clock} label="Avg Latency" value={`${overview.avgLatencyMs} ms`} accent="text-violet-400" />
            <StatCard
              icon={AlertTriangle}
              label="Failures"
              value={overview.byStatus.find((s) => s.status === 'FAILURE')?.count || 0}
              accent="text-rose-400"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Token Usage Over Time" subtitle="Input vs output tokens">
              <TimeAreaChart
                data={series}
                bucket={bucket}
                series={[
                  { key: 'inputTokens', label: 'Input', color: CHART_COLORS.sky, stack: true },
                  { key: 'outputTokens', label: 'Output', color: CHART_COLORS.amber, stack: true },
                ]}
              />
            </ChartCard>
            <ChartCard title="Requests Over Time" subtitle="Request volume per interval">
              <TimeBarChart data={series} bucket={bucket} series={[{ key: 'requests', label: 'Requests', color: CHART_COLORS.emerald }]} />
            </ChartCard>
            <ChartCard title="Tokens by Provider Over Time" subtitle="GROQ vs NVIDIA">
              <TimeAreaChart
                data={series}
                bucket={bucket}
                series={[
                  { key: 'groqTokens', label: 'GROQ', color: CHART_COLORS.violet, stack: true },
                  { key: 'nvidiaTokens', label: 'NVIDIA', color: CHART_COLORS.emerald, stack: true },
                ]}
              />
            </ChartCard>
            <ChartCard title="Failures &amp; Fallbacks Over Time" subtitle="Failed calls and calls that fell back to NVIDIA">
              <TimeBarChart
                data={series}
                bucket={bucket}
                series={[
                  { key: 'failures', label: 'Failures', color: CHART_COLORS.rose, stack: true },
                  { key: 'fallbacks', label: 'Fallbacks', color: CHART_COLORS.amber, stack: true },
                ]}
              />
            </ChartCard>
            <ChartCard title="Average Latency" subtitle="Milliseconds per AI call">
              <TimeLineChart data={series} bucket={bucket} unit="ms" series={[{ key: 'avgLatencyMs', label: 'Avg latency', color: CHART_COLORS.violet }]} />
            </ChartCard>
            <ChartCard title="Active AI Users" subtitle="Distinct users per interval">
              <TimeLineChart data={series} bucket={bucket} series={[{ key: 'activeUsers', label: 'Active users', color: CHART_COLORS.sky }]} />
            </ChartCard>
            <ChartCard title="Provider Share" subtitle="Requests by provider">
              <DonutChart
                data={overview.byProvider.map((p) => ({ name: p.provider, value: p.count }))}
                colors={[CHART_COLORS.violet, CHART_COLORS.emerald, CHART_COLORS.sky]}
              />
            </ChartCard>
            <ChartCard title="Outcome Share" subtitle="Success / failure / fallback">
              <DonutChart
                data={overview.byStatus.map((s) => ({ name: s.status, value: s.count }))}
                colors={[CHART_COLORS.emerald, CHART_COLORS.rose, CHART_COLORS.amber]}
              />
            </ChartCard>
            <ChartCard title="Top Users by Tokens" subtitle="Highest consumers in this window" className="lg:col-span-2">
              <HorizontalBarChart
                data={users.slice(0, 10).map((u) => ({ name: u.email, tokens: u.totalTokens }))}
                nameKey="name"
                valueKey="tokens"
                color={CHART_COLORS.amber}
              />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="text-sm font-bold text-slate-200 mb-3">Tokens by Provider</h2>
              <div className="space-y-2">
                {overview.byProvider.map((p) => (
                  <div key={p.provider} className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-300">{p.provider}</span>
                    <span className="text-slate-400">{p.count} req · {p.totalTokens.toLocaleString()} tok</span>
                  </div>
                ))}
                {overview.byProvider.length === 0 && <p className="text-xs text-slate-500">No AI activity yet.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="text-sm font-bold text-slate-200 mb-3">Requests by Status</h2>
              <div className="space-y-2">
                {overview.byStatus.map((s) => (
                  <div key={s.status} className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-300">{s.status}</span>
                    <span className="text-slate-400">{s.count}</span>
                  </div>
                ))}
                {overview.byStatus.length === 0 && <p className="text-xs text-slate-500">No AI activity yet.</p>}
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-bold text-slate-200 mb-3">Top Users by Token Usage</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 uppercase tracking-wide">
                <th className="py-1.5 pr-4">User</th>
                <th className="py-1.5 pr-4">Role</th>
                <th className="py-1.5 pr-4">Requests</th>
                <th className="py-1.5 pr-4">Total Tokens</th>
                <th className="py-1.5 pr-4">Last Used</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.userId} className="border-t border-slate-800">
                  <td className="py-1.5 pr-4 text-slate-200">{u.fullName} <span className="text-slate-500">({u.email})</span></td>
                  <td className="py-1.5 pr-4 text-slate-400">{u.role}</td>
                  <td className="py-1.5 pr-4 text-slate-400">{u.requests}</td>
                  <td className="py-1.5 pr-4 text-amber-300 font-semibold">{u.totalTokens.toLocaleString()}</td>
                  <td className="py-1.5 pr-4 text-slate-500">{u.lastUsedAt ? new Date(u.lastUsedAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">No AI usage recorded in this window.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-bold text-slate-200 mb-3">Recent AI Requests</h2>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 uppercase tracking-wide sticky top-0 bg-slate-900">
                <th className="py-1.5 pr-4">Time</th>
                <th className="py-1.5 pr-4">User</th>
                <th className="py-1.5 pr-4">Provider</th>
                <th className="py-1.5 pr-4">Status</th>
                <th className="py-1.5 pr-4">Tokens</th>
                <th className="py-1.5 pr-4">Latency</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-slate-800">
                  <td className="py-1.5 pr-4 text-slate-500">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="py-1.5 pr-4 text-slate-300">{l.userEmail}</td>
                  <td className="py-1.5 pr-4 text-slate-400">{l.provider} {l.model ? `(${l.model})` : ''}</td>
                  <td className={`py-1.5 pr-4 font-semibold ${l.status === 'FAILURE' ? 'text-rose-400' : l.status === 'FALLBACK' ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {l.status}{l.errorCode ? ` (${l.errorCode})` : ''}
                  </td>
                  <td className="py-1.5 pr-4 text-slate-400">{l.totalTokens ?? '—'}</td>
                  <td className="py-1.5 pr-4 text-slate-400">{l.latencyMs ? `${l.latencyMs} ms` : '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-500">No requests yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-bold text-slate-200 mb-3">System Logs</h2>
        <div className="overflow-x-auto max-h-80 overflow-y-auto font-mono">
          {systemLogs.map((l) => (
            <div key={l.id} className="flex gap-3 text-xs py-1 border-b border-slate-800/60">
              <span className="text-slate-600 shrink-0">{new Date(l.createdAt).toLocaleTimeString()}</span>
              <span
                className={`shrink-0 font-bold ${
                  l.level === 'ERROR' ? 'text-rose-400' : l.level === 'WARN' ? 'text-amber-400' : 'text-sky-400'
                }`}
              >
                {l.level}
              </span>
              <span className="text-slate-500 shrink-0">[{l.source}]</span>
              <span className="text-slate-300 truncate">{l.message}</span>
            </div>
          ))}
          {systemLogs.length === 0 && <p className="text-xs text-slate-500 py-4">No system logs recorded yet.</p>}
        </div>
      </div>
    </div>
  );
};
