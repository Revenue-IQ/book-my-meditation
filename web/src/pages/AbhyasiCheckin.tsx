import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import Stars from '../components/Stars';

// Recharts is ~400 kB minified; load it only when this page actually shows the graph.
const MoodPracticeChart = lazy(() => import('../components/MoodPracticeChart'));
import { addLocalDays, api, localDay, MOODS, PRACTICE_LABELS, PRACTICES, tzMinutes, type CheckinPage, type Practice, type RangeDays, type TodayCheckin } from '../api';

export default function AbhyasiCheckin() {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [days, setDays] = useState<RangeDays>(30);
  const today = localDay();
  const key = ['checkin', today, days];
  // keepPreviousData: switching the range keeps the old stats on screen (and the chart
  // mounted, so its practice selection survives) until the new window arrives.
  const page = useQuery({
    queryKey: key,
    queryFn: () => api<CheckinPage>(`/api/abhyasi/checkin?today=${today}&days=${days}&tz=${tzMinutes()}`),
    placeholderData: keepPreviousData,
  });

  // Every tap updates the cached "today" immediately (optimistic), so the page never waits
  // on the network. Any in-flight refetch is cancelled first so a stale response cannot
  // overwrite a newer tap; the stats refresh after the save lands.
  const apply = async (t: NonNullable<TodayCheckin>) => {
    await qc.cancelQueries({ queryKey: key });
    qc.setQueryData<CheckinPage>(key, (old) => (old ? { ...old, today: t } : old));
  };
  const settled = async (t: NonNullable<TodayCheckin>) => {
    await apply(t);
    qc.invalidateQueries({ queryKey: ['checkin'] });
  };
  const setMood = useMutation({
    mutationFn: (mood: number) => api<NonNullable<TodayCheckin>>('/api/abhyasi/checkin', { method: 'PUT', body: JSON.stringify({ day: today, mood }) }),
    onSuccess: settled,
    onError: (e: Error) => setError(e.message),
  });
  const setPractices = useMutation({
    mutationFn: (practices: Practice[]) => api<NonNullable<TodayCheckin>>('/api/abhyasi/checkin', { method: 'PATCH', body: JSON.stringify({ day: today, practices }) }),
    onSuccess: settled,
    onError: (e: Error) => setError(e.message),
  });

  const t = page.data?.today ?? null;
  const toggle = (p: Practice) => {
    if (!t) return;
    const next = t.practices.includes(p) ? t.practices.filter((x) => x !== p) : [...t.practices, p];
    void apply({ ...t, practices: next }).then(() => setPractices.mutate(next));
  };

  const stats = page.data?.stats;

  return (
    <div className="space-y-8">
      {error && (
        <p className="cursor-pointer rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" onClick={() => setError('')}>
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-center text-lg font-semibold">{t ? 'Today you feel' : 'How are you today?'}</h2>
        <p className="mt-1 text-center text-sm text-stone-500">{t ? 'Tap another face any time to change it.' : 'Tap the face that fits. It saves right away.'}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3 sm:gap-6">
          {MOODS.map((m) => {
            const selected = t?.mood === m.value;
            return (
              <button
                key={m.value}
                type="button"
                aria-label={m.label}
                aria-pressed={selected}
                onClick={() => {
                  if (t) void apply({ ...t, mood: m.value }).then(() => setMood.mutate(m.value));
                  else setMood.mutate(m.value);
                }}
                className={clsx(
                  'flex w-20 flex-col items-center gap-1 rounded-2xl p-2 transition sm:w-24',
                  selected ? 'bg-violet-50 ring-2 ring-violet-400' : 'hover:bg-stone-50',
                )}
              >
                <img src={m.file} alt="" width={96} height={96} className={clsx('h-16 w-16 transition sm:h-20 sm:w-20', selected && 'scale-110')} />
                <span className={clsx('text-xs font-medium', selected ? 'text-violet-900' : 'text-stone-500')}>{m.label}</span>
              </button>
            );
          })}
        </div>

        {t && (
          <div className="mt-7 border-t border-stone-100 pt-5">
            <h3 className="text-center font-semibold">Yesterday, which of these did you do?</h3>
            <p className="mt-1 text-center text-sm text-stone-500">Each tap saves on its own.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {PRACTICES.map((p) => {
                const on = t.practices.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(p)}
                    className={clsx(
                      'flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition',
                      on ? 'border-violet-400 bg-violet-100 text-violet-900' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50',
                    )}
                  >
                    <span className={clsx('flex h-4 w-4 items-center justify-center rounded-full border', on ? 'border-violet-600 bg-violet-600 text-white' : 'border-stone-300')}>
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    {PRACTICE_LABELS[p]}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {stats && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Your last {days === 7 ? '7 days' : days === 30 ? '30 days' : days === 90 ? '3 months' : days === 180 ? '6 months' : 'year'}</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <StreakCard streak={stats.streak} days={stats.series.map((s) => s.day)} today={today} checkedToday={!!t} />
            <div className="grid grid-cols-2 gap-3">
              <Tile label="Days checked in" value={`${stats.checkins} / ${stats.days}`} />
              <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
                <Stars value={stats.avgMood} className="mt-1" />
                <div className="mt-1 text-xs text-stone-500">Average mood{stats.avgMood !== null && <span className="ml-1 tabular-nums">({stats.avgMood} / 5)</span>}</div>
              </div>
            </div>
          </div>

          <Suspense fallback={<div className="h-80 rounded-xl border border-stone-200 bg-white shadow-sm" />}>
            <MoodPracticeChart
              source={{ kind: 'you', series: stats.series, sittingDays: stats.sittings.days, today }}
              days={days}
              setDays={setDays}
              practices={stats.practices}
              sittings={stats.sittings}
            />
          </Suspense>

          <p className="text-sm text-stone-500">
            Only you can see your check-ins.{' '}
            <Link to="/community" className="text-violet-700 underline">
              See how the whole community is doing →
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}

/** Animated flame, the streak count, and the last five days as lit/missed markers.
 *  Today without a check-in shows as pending (dashed, pulsing), never as missed. */
function StreakCard({ streak, days, today, checkedToday }: { streak: number; days: string[]; today: string; checkedToday: boolean }) {
  const checked = new Set(days);
  const last5 = Array.from({ length: 5 }, (_, i) => addLocalDays(today, i - 4));
  const initial = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'narrow' });
  };
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <img src="/emoji/1f525.webp" alt="" width={48} height={48} className={clsx('h-11 w-11', streak === 0 && 'opacity-40 grayscale')} />
        <div>
          <div className="text-2xl font-semibold tabular-nums">{streak}</div>
          <div className="text-xs text-stone-500">day streak</div>
        </div>
      </div>
      <div className="flex gap-1.5">
        {last5.map((d) => {
          const done = checked.has(d) || (d === today && checkedToday);
          const pending = d === today && !done;
          return (
            <div key={d} className="flex flex-col items-center gap-0.5">
              <div
                title={`${d}${done ? ': checked in' : pending ? ': not yet today' : ': missed'}`}
                className={clsx(
                  'flex h-7 w-7 items-center justify-center rounded-full text-sm',
                  done && 'bg-amber-100',
                  pending && 'animate-pulse border-2 border-dashed border-stone-300',
                  !done && !pending && 'bg-stone-100',
                )}
              >
                {done ? '🔥' : ''}
              </div>
              <span className="text-[10px] text-stone-400">{initial(d)}</span>
            </div>
          );
        })}
      </div>
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
