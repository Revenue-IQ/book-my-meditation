// Mood × practice/sitting graph, shared by the personal check-in page and the community
// page. Two stacked panels on a shared, hover-synced time axis (one y-scale each — never a
// dual-axis chart): mood on top, the selected practice or sittings below, so "practice days"
// line up under the mood curve. Daily points for 7/30 days; weekly averages for 3m/6m/1y.
//
// Both pages feed it the same normalized shape, one `DayAgg` per calendar day, so the chart
// itself never knows whether a day is one person's check-in or a community aggregate.
import { useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  addLocalDays,
  localDay,
  MOODS,
  PRACTICE_LABELS,
  PRACTICES,
  weekStartOf,
  type CheckinDay,
  type CommunityDay,
  type MoodComparison,
  type Practice,
  type PracticeStat,
  type RangeDays,
} from '../api';

const MOOD_COLOR = '#7c3aed'; // violet-600 — the mood series everywhere on these pages
const PRACTICE_COLOR = '#0d9488'; // teal-600 — the practice/sitting series (CVD-checked pair)

type Sel = 'all' | Practice | 'sitting';
type Who = 'you' | 'people';

/** One calendar day, aggregated. For the personal page `checkins` is 0 or 1; `suppressed`
 *  marks community days whose averages were withheld (too few check-ins to be anonymous). */
export type DayAgg = {
  day: string;
  checkins: number;
  moodSum: number;
  suppressed: boolean;
  done: number[]; // per practice, PRACTICES order
  practiceTotal: number;
  sittings: number;
};

const fmtDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const weekStartStr = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(weekStartOf(new Date(y, m - 1, d)));
};
const round1 = (n: number) => Math.round(n * 10) / 10;

/** What each page hands the chart; normalized here so the pages stay free of chart imports
 *  (the chart is lazy-loaded) and the panels never know which page they are on. */
export type ChartSource =
  | { kind: 'you'; series: CheckinDay[]; sittingDays: string[]; today: string }
  | { kind: 'people'; series: CommunityDay[] };

/** Personal page → one DayAgg per day in the window. */
function personalDayAggs(series: CheckinDay[], sittingDays: string[], today: string, days: number): DayAgg[] {
  const byDay = new Map(series.map((s) => [s.day, s]));
  const sat = new Map<string, number>();
  for (const d of sittingDays) sat.set(d, (sat.get(d) ?? 0) + 1);
  return Array.from({ length: days }, (_, i) => {
    const day = addLocalDays(today, i - (days - 1));
    const e = byDay.get(day);
    return {
      day,
      checkins: e ? 1 : 0,
      moodSum: e?.mood ?? 0,
      suppressed: false,
      done: PRACTICES.map((p) => (e?.practices.includes(p) ? 1 : 0)),
      practiceTotal: e?.practices.length ?? 0,
      sittings: sat.get(day) ?? 0,
    };
  });
}

/** Community page → DayAggs straight from the server's per-day aggregates. */
function communityDayAggs(series: CommunityDay[]): DayAgg[] {
  return series.map((d) => ({
    day: d.day,
    checkins: d.checkins,
    moodSum: d.avgMood === null ? 0 : d.avgMood * d.checkins,
    suppressed: d.checkins > 0 && d.avgMood === null,
    done: d.done ?? PRACTICES.map(() => 0),
    practiceTotal: d.practiceTotal ?? 0,
    sittings: d.sittings,
  }));
}

type Row = { x: string; mood: number | null; band: number | null };

/** Mood and band values for one group of days (a single day, or a week's worth). */
function toRow(x: string, aggs: DayAgg[], sel: Sel, who: Who, weekly: boolean): Row {
  // Suppressed days carry no mood/practice data, so they count toward nothing here;
  // their sittings (plain attendance counts) still do.
  const open = aggs.filter((a) => !a.suppressed);
  const checkins = open.reduce((n, a) => n + a.checkins, 0);
  const mood = checkins ? round1(open.reduce((n, a) => n + a.moodSum, 0) / checkins) : null;
  let band: number | null;
  if (sel === 'sitting') band = aggs.reduce((n, a) => n + a.sittings, 0);
  else if (!checkins) band = null;
  else if (sel === 'all') band = round1(open.reduce((n, a) => n + a.practiceTotal, 0) / checkins);
  else {
    const doneCount = open.reduce((n, a) => n + a.done[PRACTICES.indexOf(sel)], 0);
    // One person, one day: show done/not. Averages (weekly, or community): % of check-ins.
    band = who === 'you' && !weekly ? doneCount : Math.round((doneCount / checkins) * 100);
  }
  return { x, mood, band };
}

function buildRows(aggs: DayAgg[], sel: Sel, who: Who, weekly: boolean): Row[] {
  if (!weekly) return aggs.map((a) => toRow(a.day, [a], sel, who, false));
  const byWeek = new Map<string, DayAgg[]>();
  for (const a of aggs) {
    const w = weekStartStr(a.day);
    byWeek.set(w, [...(byWeek.get(w) ?? []), a]);
  }
  return [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([w, as]) => toRow(w, as, sel, who, true));
}

/** One-line summary above the graph: the number the graph makes you eyeball. */
function Headline({ sel, who, practices, sittings, aggs }: { sel: Sel; who: Who; practices: PracticeStat[]; sittings: MoodComparison; aggs: DayAgg[] }) {
  const whose = who === 'you' ? 'your mood' : "the community's mood";
  if (sel === 'all') {
    const open = aggs.filter((a) => !a.suppressed);
    const checkins = open.reduce((n, a) => n + a.checkins, 0);
    if (!checkins) return <p className="text-sm text-stone-500">No check-ins in this period yet.</p>;
    const avg = round1(open.reduce((n, a) => n + a.practiceTotal, 0) / checkins);
    return (
      <p className="text-sm text-stone-600">
        {who === 'you' ? 'You averaged' : 'People averaged'} <span className="font-semibold text-stone-900">{avg} of 5 practices</span> per day in this period.
      </p>
    );
  }
  const s = sel === 'sitting' ? sittings : practices.find((p) => p.practice === sel);
  if (!s) return null;
  const name = sel === 'sitting' ? 'a sitting' : PRACTICE_LABELS[sel];
  if (s.delta === null)
    return (
      <p className="text-sm text-stone-500">
        Not enough data to compare yet — it takes at least 3 days both with and without {name} ({s.doneDays} with, {s.notDoneDays} without so far).
      </p>
    );
  const up = s.delta > 0;
  return (
    <p className="text-sm text-stone-600">
      After {name} {whose} averages <span className="font-semibold text-stone-900">{s.avgMoodAfterDone}</span> vs{' '}
      <span className="font-semibold text-stone-900">{s.avgMoodAfterNotDone}</span> without —{' '}
      <span className={up ? 'font-semibold text-teal-700' : s.delta < 0 ? 'font-semibold text-amber-700' : 'font-semibold'}>
        {up ? '+' : ''}
        {s.delta}
      </span>{' '}
      <span className="text-stone-400">({s.doneDays} vs {s.notDoneDays} days)</span>
    </p>
  );
}

export default function MoodPracticeChart({
  source,
  days,
  setDays,
  practices,
  sittings,
}: {
  source: ChartSource;
  days: RangeDays;
  setDays: (d: RangeDays) => void;
  practices: PracticeStat[];
  sittings: MoodComparison;
}) {
  const [sel, setSel] = useState<Sel>('all');
  const weekly = days >= 90;
  const who: Who = source.kind;
  const aggs = useMemo(
    () => (source.kind === 'you' ? personalDayAggs(source.series, source.sittingDays, source.today, days) : communityDayAggs(source.series)),
    [source, days],
  );
  const rows = useMemo(() => buildRows(aggs, sel, who, weekly), [aggs, sel, who, weekly]);

  // What the bottom panel shows, per selection/granularity/page.
  const band = useMemo(() => {
    if (sel === 'sitting') {
      const max = Math.max(2, ...rows.map((r) => r.band ?? 0));
      return {
        label: weekly ? 'Sittings per week' : 'Sittings',
        domain: [0, max] as [number, number],
        ticks: [0, max],
        fmt: (v: number) => String(v),
        tooltip: (v: number) => [`${v} sitting${v === 1 ? '' : 's'}`, 'Sittings'] as [string, string],
      };
    }
    if (sel === 'all')
      return {
        label: weekly ? 'Average practices per day, by week' : 'Practices done (day before)',
        domain: [0, 5] as [number, number],
        ticks: [0, 5],
        fmt: (v: number) => String(v),
        tooltip: (v: number) => [`${v} / 5${weekly || who === 'people' ? ' per day' : ''}`, 'Practices'] as [string, string],
      };
    const name = PRACTICE_LABELS[sel];
    if (who === 'you' && !weekly)
      return {
        label: `${name} (day before)`,
        domain: [0, 1] as [number, number],
        ticks: [] as number[],
        fmt: (v: number) => String(v),
        tooltip: (v: number) => [v ? 'Done' : 'Not done', `${name} (day before)`] as [string, string],
      };
    return {
      label: `${name} (day before), % of ${who === 'you' ? 'checked-in days' : 'check-ins'}`,
      domain: [0, 100] as [number, number],
      ticks: [0, 100],
      fmt: (v: number) => `${v}%`,
      tooltip: (v: number) => [`${v}%`, name] as [string, string],
    };
  }, [sel, weekly, who, rows]);

  const selectCls =
    'rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-medium text-stone-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400';
  const axis = { stroke: '#a8a29e', fontSize: 11 } as const;
  const labelFmt = (d: unknown) => (weekly ? `Week of ${fmtDay(String(d))}` : fmtDay(String(d)));
  const syncId = `moodpractice-${who}`;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="mr-auto text-sm font-semibold text-stone-700">Mood &amp; practice</div>
        <select className={selectCls} value={days} aria-label="Time range" onChange={(e) => setDays(Number(e.target.value) as RangeDays)}>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>3 months</option>
          <option value={180}>6 months</option>
          <option value={365}>1 year</option>
        </select>
        <select className={selectCls} value={sel} aria-label="Practice" onChange={(e) => setSel(e.target.value as Sel)}>
          <option value="all">All practices</option>
          {PRACTICES.map((p) => (
            <option key={p} value={p}>
              {PRACTICE_LABELS[p]}
            </option>
          ))}
          <option value="sitting">Sitting</option>
        </select>
      </div>

      <div className="mb-3">
        <Headline sel={sel} who={who} practices={practices} sittings={sittings} aggs={aggs} />
      </div>

      {/* Mood panel */}
      <div className="text-xs font-medium text-stone-500">{weekly ? 'Average mood, by week' : 'Mood, day by day'}</div>
      <ResponsiveContainer width="100%" height={170}>
        <ComposedChart data={rows} syncId={syncId} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#f5f5f4" />
          <XAxis dataKey="x" tick={axis} tickLine={false} axisLine={false} tickFormatter={fmtDay} minTickGap={28} hide />
          {/* interval={0} keeps all five emoji ticks (Recharts drops edge ticks it thinks
              collide); padding keeps the 😄/😞 rows clear of the panel edges. */}
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            interval={0}
            padding={{ top: 8, bottom: 8 }}
            width={40}
            tick={{ fontSize: 13 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => MOODS[v - 1].glyph}
          />
          <Tooltip
            labelFormatter={labelFmt}
            formatter={(v) => {
              const n = Number(v);
              const exact = who === 'you' && !weekly && Number.isInteger(n);
              return [exact ? `${MOODS[n - 1]?.glyph ?? ''} ${MOODS[n - 1]?.label ?? n}` : `${n} / 5`, exact ? 'Mood' : 'Average mood'];
            }}
          />
          {/* connectNulls: a missed day doesn't break the curve — it just has no dot. */}
          <Line type="monotone" dataKey="mood" stroke={MOOD_COLOR} strokeWidth={2} connectNulls dot={{ r: weekly ? 2.5 : 3, fill: MOOD_COLOR, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Practice/sitting panel, aligned under the mood panel on the same time axis */}
      <div className="mt-1 text-xs font-medium text-stone-500">{band.label}</div>
      <ResponsiveContainer width="100%" height={92}>
        <ComposedChart data={rows} syncId={syncId} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#f5f5f4" />
          <XAxis dataKey="x" tick={axis} tickLine={false} axisLine={false} tickFormatter={fmtDay} minTickGap={28} />
          <YAxis
            domain={band.domain}
            ticks={band.ticks}
            width={40}
            tick={band.ticks.length ? axis : false}
            tickLine={false}
            axisLine={false}
            tickFormatter={band.fmt}
          />
          <Tooltip labelFormatter={labelFmt} formatter={(v) => band.tooltip(Number(v))} />
          <Bar dataKey="band" fill={PRACTICE_COLOR} radius={[3, 3, 0, 0]} maxBarSize={weekly ? 10 : 14} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>

      <p className="mt-2 text-xs text-stone-400">
        Practices and sittings count for the day before the mood. These are patterns, not proof.
        {who === 'people' && ' Days with very few check-ins show no average, so no one is identifiable.'}
      </p>
    </div>
  );
}
