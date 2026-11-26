import React, { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SessionAttempt } from '../types/cbt';
import {
  buildPerformanceTrendData,
  formatDurationVerbose,
  type PerformanceTrendPoint,
} from '../utils/examEngine';

interface PerformanceTrendChartProps {
  allSessions: SessionAttempt[];
  currentSession: SessionAttempt;
  onSelectSession?: (session: SessionAttempt) => void;
}

type TrendMetric = 'netScore' | 'accuracyPercent';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PerformanceTrendPoint }>;
}

const TrendTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 shadow-md text-xs space-y-1">
      <div className="font-semibold text-slate-900">
        Attempt {pt.attemptLabel} · {pt.dateShort}
        {pt.isCurrent ? ' (Current)' : ''}
      </div>
      {pt.isSubsetAttempt && (
        <div className="text-[11px] text-slate-500">Mistake Re-attempt</div>
      )}
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1 border-t border-slate-100 font-mono-tabular">
        <span className="text-slate-500">Net Score:</span>
        <span className="font-semibold text-slate-900 text-right">
          {pt.netScore} / {pt.maxScore}
        </span>
        <span className="text-slate-500">Accuracy:</span>
        <span className="font-semibold text-slate-900 text-right">
          {pt.accuracyPercent}%
        </span>
        <span className="text-slate-500">Time:</span>
        <span className="font-semibold text-slate-900 text-right">
          {formatDurationVerbose(pt.totalTimeSeconds)}
        </span>
      </div>
    </div>
  );
};

export const PerformanceTrendChart: React.FC<PerformanceTrendChartProps> = ({
  allSessions,
  currentSession,
  onSelectSession,
}) => {
  const [metric, setMetric] = useState<TrendMetric>('netScore');

  const trendData = useMemo(
    () => buildPerformanceTrendData(allSessions, currentSession.setId, currentSession.id),
    [allSessions, currentSession.setId, currentSession.id]
  );

  const sessionsById = useMemo(() => {
    const map = new Map<string, SessionAttempt>();
    for (const s of allSessions) {
      map.set(s.id, s);
    }
    return map;
  }, [allSessions]);

  const yAxisDomain = useMemo<[number, number]>(() => {
    if (metric === 'accuracyPercent') {
      return [0, 100];
    }
    const maxPossible = trendData.reduce((m, d) => Math.max(m, d.maxScore), currentSession.maxScore || 40);
    const minObserved = trendData.reduce((m, d) => Math.min(m, d.netScore), 0);
    return [minObserved < 0 ? Math.floor(minObserved / 4) * 4 - 4 : 0, maxPossible];
  }, [metric, trendData, currentSession.maxScore]);

  const previousDelta = useMemo(() => {
    const idx = trendData.findIndex((d) => d.isCurrent);
    if (idx <= 0) return null;
    const prev = trendData[idx - 1];
    const curr = trendData[idx];
    if (metric === 'netScore') {
      const diff = curr.netScore - prev.netScore;
      return {
        label: `${diff >= 0 ? '+' : ''}${diff} marks vs ${prev.attemptLabel}`,
        positive: diff >= 0,
      };
    }
    const diff = Math.round((curr.accuracyPercent - prev.accuracyPercent) * 10) / 10;
    return {
      label: `${diff >= 0 ? '+' : ''}${diff}% vs ${prev.attemptLabel}`,
      positive: diff >= 0,
    };
  }, [trendData, metric]);

  return (
    <section
      aria-labelledby="performance-trends-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#0F4C81]" aria-hidden="true" />
            <h2 id="performance-trends-heading" className="text-base font-semibold text-slate-900">
              Performance Trend Across Sessions
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            {trendData.length === 1
              ? '1 attempt recorded for this set. Complete additional sessions to track progression.'
              : `Comparing ${trendData.length} attempts of "${currentSession.setTitle}". Highlighted bar marks this session.`}
            {previousDelta && (
              <>
                {' · '}
                <span
                  className={`font-semibold font-mono-tabular ${
                    previousDelta.positive ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {previousDelta.label}
                </span>
              </>
            )}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Select trend chart metric"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-1 self-start sm:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={metric === 'netScore'}
            onClick={() => setMetric('netScore')}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              metric === 'netScore'
                ? 'bg-white text-[#0F4C81] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Net Score
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={metric === 'accuracyPercent'}
            onClick={() => setMetric('accuracyPercent')}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              metric === 'accuracyPercent'
                ? 'bg-white text-[#0F4C81] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Accuracy (%)
          </button>
        </div>
      </div>

      <div className="h-56 w-full" data-testid="performance-trend-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={trendData}
            margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
            barCategoryGap="28%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="attemptLabel"
              tick={{ fill: '#475569', fontSize: 12, fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: '#CBD5E1' }}
              tickLine={false}
            />
            <YAxis
              domain={yAxisDomain}
              tick={{ fill: '#475569', fontSize: 12, fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={(val: number) => (metric === 'accuracyPercent' ? `${val}%` : `${val}`)}
            />
            <Tooltip content={<TrendTooltip />} cursor={{ fill: 'rgba(15, 76, 129, 0.05)' }} />
            <ReferenceLine y={0} stroke="#CBD5E1" />
            <Bar
              dataKey={metric}
              maxBarSize={52}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
              onClick={(entry) => {
                const sessId = (entry as unknown as PerformanceTrendPoint)?.sessionId;
                if (sessId && onSelectSession) {
                  const target = sessionsById.get(sessId);
                  if (target) onSelectSession(target);
                }
              }}
              className={onSelectSession ? 'cursor-pointer' : ''}
            >
              {trendData.map((entry) => (
                <Cell
                  key={entry.sessionId}
                  fill={entry.isCurrent ? '#0F4C81' : '#94A3B8'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
