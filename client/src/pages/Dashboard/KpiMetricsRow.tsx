import React, { useEffect, useState } from 'react';
import { TrendingUp, CheckCircle, DollarSign, Sparkles } from 'lucide-react';
import { dashboardService } from '../../services/dashboard.service';

interface KpiCardData {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  icon: string;
  iconBg: string;
  iconColor: string;
  subtext?: string;
}

const iconMap: Record<string, React.ElementType> = {
  TrendingUp,
  CheckCircle,
  DollarSign,
  Sparkles,
};

export const KpiMetricsRow: React.FC = () => {
  const [kpis, setKpis] = useState<KpiCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        const data = await dashboardService.getKpis();
        setKpis(data);
      } catch (error) {
        console.error('Failed to load KPIs:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchKpis();
  }, []);

  if (isLoading) {
    return <div className="h-[120px] mb-6 flex items-center justify-center text-sm text-muted-foreground border border-border rounded-xl bg-card">Loading metrics...</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
      {kpis.map((kpi) => {
        const IconComponent = iconMap[kpi.icon] || Sparkles;
        return (
          <div
            key={kpi.label}
            className="group relative rounded-xl border border-border bg-card p-5 hover:shadow-md hover:border-border/60 transition-all duration-200"
          >
            {/* Icon */}
            <div className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg ${kpi.iconBg}`}>
              <IconComponent className={`h-4.5 w-4.5 ${kpi.iconColor}`} />
            </div>

            {/* Label */}
            <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-2">
              {kpi.label}
            </p>

            {/* Value */}
            <p className="text-2xl font-bold text-foreground leading-none mb-1.5">
              {kpi.value}
            </p>

            {/* Trend */}
            <p className={`text-xs font-medium ${kpi.trendUp ? 'text-success' : 'text-danger'}`}>
              {kpi.trend}
            </p>
          </div>
        );
      })}
    </div>
  );
};
