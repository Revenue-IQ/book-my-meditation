import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import Stars from '../components/Stars';
import { api, localDay, MOODS, tzMinutes, type CommunityStats, type RangeDays } from '../api';

// Recharts is ~400 kB minified; load it only when this page actually shows the graph.
const MoodPracticeChart = lazy(() => import('../components/MoodPracticeChart'));

export default function Community() {
  const today = localDay();
  const [days, setDays] = useState<RangeDays>(30);
  // keepPreviousData: switching the range keeps the old stats on screen (and the chart
  // mounted, so its practice selection survives) until the new window arrives.
  const q = useQuery({
    queryKey: ['community', today, days],
    queryFn: () => api<CommunityStats>(`/api/community/mood?today=${today}&days=${days}&tz=${tzMinutes()}`),
    placeholderData: keepPreviousData,
  });
  const d = q.data;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Community mood</h2>
        <p className="text-sm text-stone-500">
          Across all abhyasis and all preceptors. Only averages are shown. Nobody can see an individual's check-ins.
        </p>
      </div>

      {d && !d.available && (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
          The community view appears once at least {d.needed} people have checked in. So far: {d.people}.
        </p>
      )}

      {d && d.available && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Tile label="People checking in" value={String(d.people)} />
            <Tile label="Check-ins" value={String(d.checkins)} />
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
              <Stars value={d.avgMood} className="mt-1" />
              <div className="mt-1 text-xs text-stone-500">
                Average mood <span className="ml-1 tabular-nums">({d.avgMood} / 5)</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-xs font-semibold text-stone-500">How people felt</div>
            <div className="space-y-2">
              {[...MOODS].reverse().map((m) => {
                const share = d.moodShare[m.value - 1];
                return (
                  <div key={m.value} className="flex items-center gap-3 text-sm">
                    <span className="w-6 text-center text-lg">{m.glyph}</span>
                    <span className="w-12 text-stone-600">{m.label}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full bg-violet-500" style={{ width: `${Math.round(share * 100)}%` }} />
                    </div>
                    <span className="w-10 text-right tabular-nums text-stone-600">{Math.round(share * 100)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <Suspense fallback={<div className="h-80 rounded-xl border border-stone-200 bg-white shadow-sm" />}>
            <MoodPracticeChart
              source={{ kind: 'people', series: d.series }}
              days={days}
              setDays={setDays}
              practices={d.practices}
              sittings={d.sittings}
            />
          </Suspense>
        </>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}
