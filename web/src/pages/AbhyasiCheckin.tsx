import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import PracticeTable from '../components/PracticeTable';
import { addLocalDays, api, localDay, MOODS, PRACTICE_LABELS, PRACTICES, type CheckinPage, type Practice, type TodayCheckin } from '../api';

const PERSONAL_MIN_DAYS = 3;

export default function AbhyasiCheckin() {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const today = localDay();
  const key = ['checkin', today];
  const page = useQuery({ queryKey: key, queryFn: () => api<CheckinPage>(`/api/abhyasi/checkin?today=${today}`) });

  // Every tap updates the cached "today" immediately (optimistic), so the page never waits
  // on the network. Any in-flight refetch is cancelled first so a stale response cannot
  // overwrite a newer tap; the stats refresh after the save lands.
  const apply = async (t: NonNullable<TodayCheckin>) => {
    await qc.cancelQueries({ queryKey: key });
    qc.setQueryData<CheckinPage>(key, (old) => (old ? { ...old, today: t } : old));
  };
  const settled = async (t: NonNullable<TodayCheckin>) => {
    await apply(t);
    qc.invalidateQueries({ queryKey: key });
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
  const stripDays = Array.from({ length: 30 }, (_, i) => addLocalDays(today, i - 29));
  const moodByDay = new Map(stats?.strip.map((s) => [s.day, s.mood]));

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
            const dimmed = !!t && !selected;
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
                <img
                  src={m.file}
                  alt=""
                  width={96}
                  height={96}
                  className={clsx('h-16 w-16 transition sm:h-20 sm:w-20', dimmed && 'opacity-40 grayscale', selected && 'scale-110')}
                />
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
          <h2 className="text-base font-semibold">Your last 30 days</h2>
          <div className="grid grid-cols-3 gap-3">
            <Tile label="Check-in streak" value={`${stats.streak} day${stats.streak === 1 ? '' : 's'}`} />
            <Tile label="Days checked in" value={`${stats.checkins} / 30`} />
            <Tile label="Average mood" value={stats.avgMood === null ? '–' : `${stats.avgMood} / 5`} />
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="mb-2 text-xs font-semibold text-stone-500">Mood, day by day</div>
            <div className="grid grid-cols-10 gap-1.5 sm:grid-cols-15" style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}>
              {stripDays.map((d) => {
                const mood = moodByDay.get(d);
                const m = MOODS.find((x) => x.value === mood);
                return (
                  <div
                    key={d}
                    title={`${d}${m ? `: ${m.label}` : ': no check-in'}`}
                    className={clsx('flex aspect-square items-center justify-center rounded-md text-base', m ? 'bg-violet-50' : 'bg-stone-100')}
                  >
                    {m?.glyph ?? ''}
                  </div>
                );
              })}
            </div>
          </div>

          <PracticeTable stats={stats.practices} minDays={PERSONAL_MIN_DAYS} who="you" />

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

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}
