import { useQuery } from '@tanstack/react-query';
import PracticeTable from '../components/PracticeTable';
import { api, localDay, MOODS, type CommunityStats } from '../api';

export default function Community() {
  const today = localDay();
  const q = useQuery({ queryKey: ['community', today], queryFn: () => api<CommunityStats>(`/api/community/mood?today=${today}`) });
  const d = q.data;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Community mood</h2>
        <p className="text-sm text-stone-500">
          Across all abhyasis and all preceptors, last 30 days. Only averages are shown. Nobody can see an individual's check-ins.
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
            <Tile label="Average mood" value={`${d.avgMood} / 5`} />
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

          <PracticeTable stats={d.practices} minDays={3} who="people" />
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
