import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, AlertTriangle, Lightbulb, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { dashboardService } from '../../services/dashboard.service';

interface Insight {
  type: 'warning' | 'tip' | 'success';
  title: string;
  body: string;
}

const insightStyles = {
  warning: {
    border: 'border-warning/30',
    bg: 'bg-warning/5',
    icon: AlertTriangle,
    iconColor: 'text-warning',
  },
  tip: {
    border: 'border-info/30',
    bg: 'bg-info/5',
    icon: Lightbulb,
    iconColor: 'text-info',
  },
  success: {
    border: 'border-success/30',
    bg: 'bg-success/5',
    icon: CheckCircle,
    iconColor: 'text-success',
  },
};

export const AiInsightsPanel: React.FC = () => {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const data = await dashboardService.getInsights();
        setInsights(data);
      } catch (error) {
        console.error('Failed to load insights:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInsights();
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-secondary" />
          <h3 className="font-semibold text-foreground">AI Insights</h3>
        </div>
        <button
          onClick={() => navigate('/analytics')}
          className="flex items-center gap-1 text-sm text-primary font-medium hover:underline"
        >
          View analytics <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Insights List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="text-center text-sm text-muted-foreground mt-4">Loading insights...</div>
        ) : insights.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground mt-4">No new insights.</div>
        ) : (
          insights.map((insight, i) => {
            const style = insightStyles[insight.type] || insightStyles.tip;

            return (
              <div
                key={i}
                className={cn(
                  'rounded-lg border p-3.5 transition-all duration-200 hover:shadow-sm cursor-pointer',
                  style.border,
                  style.bg
                )}
              >
                <p className={cn('text-xs font-bold mb-1', style.iconColor)}>
                  {insight.title}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {insight.body}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* CTA */}
      <div className="shrink-0 px-4 pb-4">
        <button
          onClick={() => navigate('/ai-assistant')}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-secondary/30 bg-secondary/5 py-2.5 text-sm font-medium text-secondary hover:bg-secondary/10 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Open AI Assistant
        </button>
      </div>
    </div>
  );
};
