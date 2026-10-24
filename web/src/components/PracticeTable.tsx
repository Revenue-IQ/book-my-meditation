import clsx from 'clsx';
import { PRACTICE_LABELS, type PracticeStat } from '../api';

/** Per-practice consistency and "mood the day after" comparison. Shared by personal and community views. */
export default function PracticeTable({ stats, minDays, who }: { stats: PracticeStat[]; minDays: number; who: 'you' | 'people' }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-left text-xs font-semibold text-stone-500">
          <tr>
            <th className="px-4 py-2">Practice</th>
            <th className="px-3 py-2">How often {who === 'you' ? 'you did it' : 'it was done'}</th>
            <th className="px-3 py-2 text-right">Mood after doing</th>
            <th className="px-3 py-2 text-right">Mood after skipping</th>
            <th className="px-3 py-2 text-right">Difference</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((p) => {
            const need = Math.max(0, minDays - p.doneDays) + Math.max(0, minDays - p.notDoneDays);
            return (
              <tr key={p.practice} className="border-t border-stone-100">
                <td className="px-4 py-2.5 font-medium">{PRACTICE_LABELS[p.practice]}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full bg-violet-500" style={{ width: `${Math.round(p.consistency * 100)}%` }} />
                    </div>
                    <span className="tabular-nums text-stone-600">{Math.round(p.consistency * 100)}%</span>
                    <span className="text-xs text-stone-400">
                      {p.doneDays}/{p.doneDays + p.notDoneDays} days
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{p.avgMoodAfterDone ?? <span className="text-stone-300">–</span>}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{p.avgMoodAfterNotDone ?? <span className="text-stone-300">–</span>}</td>
                <td className="px-3 py-2.5 text-right">
                  {p.delta === null ? (
                    <span className="text-xs text-stone-400">
                      {p.doneDays + p.notDoneDays === 0 ? 'no data yet' : `${need} more day${need === 1 ? '' : 's'} needed`}
                    </span>
                  ) : (
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                        p.delta > 0.15 ? 'bg-emerald-100 text-emerald-800' : p.delta < -0.15 ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600',
                      )}
                    >
                      {p.delta > 0 ? '+' : ''}
                      {p.delta.toFixed(2)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-stone-100 px-4 py-2 text-xs text-stone-400">
        Mood is 1 (low) to 5 (great). "After doing" compares the mood {who === 'you' ? 'you' : 'people'} reported the day after a practice with the mood after skipping it. These are patterns, not proof.
      </p>
    </div>
  );
}
