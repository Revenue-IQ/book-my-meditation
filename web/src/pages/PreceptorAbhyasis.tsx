import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, Copy, Mail, Pencil, Settings2, UserMinus, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import EditUserModal from '../components/EditUserModal';
import {
  CLERK_ENABLED,
  api,
  type AbhyasiInviteResult,
  fmtDate,
  fmtTime,
  periodAnchors,
  type AbhyasiHistory,
  type AbhyasiOverview,
  type AbhyasiRow,
  type Prefs,
  type RegularityStatus,
  type WeekCell,
} from '../api';

const STATUS: Record<RegularityStatus, { label: string; style: string; hint: string }> = {
  not_seen: { label: 'Not seen', style: 'bg-red-100 text-red-800', hint: 'No sitting for the threshold or longer. Worth checking in.' },
  slipping: { label: 'Slipping', style: 'bg-amber-100 text-amber-800', hint: 'Used to come regularly, nothing in the last two weeks.' },
  active: { label: 'Active', style: 'bg-emerald-100 text-emerald-800', hint: 'Sat recently, with you or another preceptor.' },
  new: { label: 'New', style: 'bg-sky-100 text-sky-800', hint: 'Linked recently, no sitting yet.' },
};

function weekLabel(c: WeekCell) {
  const d = new Date(c.start);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6); // calendar days: +6*24h drifts across DST
  const range = `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  const parts = [];
  if (c.mine) parts.push(`${c.mine} with you`);
  if (c.elsewhere) parts.push(`${c.elsewhere} elsewhere`);
  return `${range}: ${parts.length ? parts.join(', ') : 'no sitting'}`;
}

function WeekDots({ weeks }: { weeks: WeekCell[] }) {
  return (
    <div className="flex items-center gap-1" aria-label="Sittings per week, oldest first">
      {weeks.map((c) => (
        <span
          key={c.start}
          title={weekLabel(c)}
          className={clsx(
            'inline-block h-3 w-3 rounded-full border-2',
            c.mine > 0
              ? 'border-emerald-600 bg-emerald-600'
              : c.elsewhere > 0
                ? 'border-emerald-600 bg-white'
                : 'border-stone-200 bg-stone-100',
          )}
        />
      ))}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}

export default function PreceptorAbhyasis() {
  const qc = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [note, setNote] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');

  const anchors = periodAnchors();
  const q = new URLSearchParams(anchors).toString();
  const overview = useQuery({
    queryKey: ['abhyasiOverview', anchors.weekStart],
    queryFn: () => api<AbhyasiOverview>(`/api/preceptor/abhyasis/overview?${q}`),
  });

  const [unlinkId, setUnlinkId] = useState<string | null>(null);
  const unlink = useMutation({
    mutationFn: (id: string) => api(`/api/preceptor/abhyasis/${id}/link`, { method: 'DELETE' }),
    onSuccess: (_r, id) => {
      const who = overview.data?.abhyasis.find((a) => a.id === id);
      setNote(`${who?.name ?? 'They'} removed from your abhyasis. Their account and history stay; inviting the same email links them again.`);
      setUnlinkId(null);
      qc.invalidateQueries({ queryKey: ['abhyasiOverview'] });
    },
    onError: (e) => {
      setUnlinkId(null);
      setError(e.message);
    },
  });

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(email);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError('Could not copy. The address is ' + email);
    }
  };

  const data = overview.data;
  const needAttention = data?.abhyasis.filter((a) => a.status === 'not_seen' || a.status === 'slipping').length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">My Abhyasis</h2>
          <p className="text-sm text-stone-500">
            Who has been sitting regularly, and who may need a personal check-in.
            {data && needAttention > 0 && <> <span className="font-medium text-amber-800">{needAttention} to follow up.</span></>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
            onClick={() => setShowInvite((s) => !s)}
          >
            <UserPlus className="h-4 w-4" /> Invite abhyasi
          </button>
          <button
            className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-100"
            onClick={() => setShowSettings((s) => !s)}
          >
            <Settings2 className="h-4 w-4" /> Settings
          </button>
        </div>
      </div>

      {showInvite && (
        <InvitePanel
          onDone={(message) => {
            setNote(message);
            setShowInvite(false);
            qc.invalidateQueries({ queryKey: ['abhyasiOverview'] });
          }}
          onError={(e) => setNote(e.message)}
        />
      )}
      {note && (
        <p className="cursor-pointer rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" onClick={() => setNote('')}>
          {note}
        </p>
      )}

      {error && (
        <p className="cursor-pointer rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" onClick={() => setError('')}>
          {error}
        </p>
      )}

      {showSettings && data && (
        <SettingsPanel
          prefs={data.prefs}
          onSaved={() => {
            setShowSettings(false);
            qc.invalidateQueries({ queryKey: ['abhyasiOverview'] });
          }}
          onError={(e) => setError(e.message)}
        />
      )}

      {data && (
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Sittings given this month" value={data.stats.monthSittings} />
          <StatTile label="Sittings given this year" value={data.stats.yearSittings} />
          <StatTile label="Abhyasis served this month" value={data.stats.monthAbhyasis} />
        </div>
      )}

      {data && data.abhyasis.length === 0 && (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">No abhyasis linked to you yet.</p>
      )}

      {data && data.abhyasis.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs font-semibold text-stone-500">
              <tr>
                <th className="px-4 py-2">Abhyasi</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Last {data.prefs.historyWeeks} weeks</th>
                <th className="px-3 py-2">Last sitting</th>
                <th className="px-3 py-2 text-right">Sittings</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.abhyasis.map((a) => (
                <tr
                  key={a.id}
                  className="cursor-pointer border-t border-stone-100 hover:bg-emerald-50/40"
                  onClick={() => setDetailId(a.id)}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-stone-500">{a.email}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span title={STATUS[a.status].hint} className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', STATUS[a.status].style)}>
                      {STATUS[a.status].label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <WeekDots weeks={a.weeks} />
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {a.lastSitting ? (
                      <>
                        {fmtDate(a.lastSitting.at)}
                        <span className="ml-1 text-xs text-stone-500">{a.lastSitting.mine ? 'with you' : 'elsewhere'}</span>
                      </>
                    ) : (
                      <span className="text-stone-400">never</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{a.sittingsInWindow}</td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <button title="Copy email" className="rounded-lg p-1.5 hover:bg-stone-100" onClick={() => copyEmail(a.email)}>
                        {copied === a.email ? <Check className="h-4 w-4 text-emerald-700" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <a title="Send email" className="rounded-lg p-1.5 hover:bg-stone-100" href={`mailto:${a.email}`}>
                        <Mail className="h-4 w-4" />
                      </a>
                      <button title="Edit name or email" className="rounded-lg p-1.5 hover:bg-stone-100" onClick={() => setEditId(a.id)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        title="Remove from my abhyasis"
                        className="rounded-lg p-1.5 text-red-700 hover:bg-red-50"
                        onClick={() => setUnlinkId(a.id)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-4 border-t border-stone-100 px-4 py-2 text-xs text-stone-500">
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full border-2 border-emerald-600 bg-emerald-600" /> sat with you</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full border-2 border-emerald-600 bg-white" /> sat with another preceptor</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full border-2 border-stone-200 bg-stone-100" /> no sitting</span>
            <span className="ml-auto">A sitting is a booking that was not cancelled and whose time has passed.</span>
          </div>
        </div>
      )}

      {detailId && data && (
        <HistoryModal
          row={data.abhyasis.find((a) => a.id === detailId)!}
          weekStart={anchors.weekStart}
          onClose={() => setDetailId(null)}
        />
      )}

      {unlinkId && data && (
        <ConfirmDialog
          title={`Remove ${data.abhyasis.find((a) => a.id === unlinkId)?.name} from your abhyasis?`}
          body={
            'Their account and history stay, and any existing bookings with you remain until cancelled. Inviting the same email links them again.'
          }
          confirmLabel="Remove"
          danger
          pending={unlink.isPending}
          onConfirm={() => unlink.mutate(unlinkId)}
          onClose={() => setUnlinkId(null)}
        />
      )}

      {editId && data && (
        <EditUserModal
          user={data.abhyasis.find((a) => a.id === editId)!}
          endpoint={`/api/preceptor/abhyasis/${editId}`}
          onSaved={() => {
            setEditId(null);
            qc.invalidateQueries({ queryKey: ['abhyasiOverview'] });
          }}
          onClose={() => setEditId(null)}
        />
      )}
    </div>
  );
}

function InvitePanel({ onDone, onError }: { onDone: (message: string) => void; onError: (e: Error) => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const invite = useMutation({
    mutationFn: () => api<AbhyasiInviteResult>('/api/preceptor/invites', { method: 'POST', body: JSON.stringify({ firstName, lastName, email }) }),
    onSuccess: (r) => {
      const who = email.trim();
      if (r.created) {
        onDone(r.invited ? `Invitation email sent to ${who}.` : `${who} added and linked to you. No email goes out in local no-login mode.`);
      } else if (r.linked) {
        onDone(`${who} is already on the app — now linked to you.${r.invited ? ' Their invitation email was resent.' : ''}`);
      } else {
        onDone(`${who} is already linked to you.${r.invited ? ' Their invitation email was resent.' : ''}`);
      }
    },
    onError,
  });
  return (
    <form
      className="flex flex-wrap items-end gap-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        invite.mutate();
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium">First name</span>
        <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-36 rounded-lg border border-stone-300 bg-white px-2 py-1.5" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Last name <span className="font-normal text-stone-400">(optional)</span></span>
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-36 rounded-lg border border-stone-300 bg-white px-2 py-1.5" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Email</span>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-60 rounded-lg border border-stone-300 bg-white px-2 py-1.5" />
      </label>
      <button type="submit" disabled={invite.isPending} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
        Invite
      </button>
      <p className="basis-full text-xs text-stone-500">
        {CLERK_ENABLED
          ? 'A new person gets an invitation email and is linked to you when they accept. Someone already on the app is just linked — no new account, no email.'
          : 'Local no-login mode: accounts and links are created, but no email is sent.'}
      </p>
    </form>
  );
}

function SettingsPanel({ prefs, onSaved, onError }: { prefs: Prefs; onSaved: () => void; onError: (e: Error) => void }) {
  const [historyWeeks, setHistoryWeeks] = useState(prefs.historyWeeks);
  const [notSeenWeeks, setNotSeenWeeks] = useState(prefs.notSeenWeeks);
  const save = useMutation({
    mutationFn: () => api<Prefs>('/api/preceptor/prefs', { method: 'PATCH', body: JSON.stringify({ historyWeeks, notSeenWeeks }) }),
    onSuccess: onSaved,
    onError,
  });
  return (
    <form
      className="flex flex-wrap items-end gap-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium">Weeks shown</span>
        <input type="number" min={4} max={26} value={historyWeeks} onChange={(e) => setHistoryWeeks(Number(e.target.value))} className="w-20 rounded-lg border border-stone-300 px-2 py-1.5" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium">Flag as "not seen" after (weeks)</span>
        <input type="number" min={1} max={12} value={notSeenWeeks} onChange={(e) => setNotSeenWeeks(Number(e.target.value))} className="w-20 rounded-lg border border-stone-300 px-2 py-1.5" />
      </label>
      <button type="submit" disabled={save.isPending} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
        Save
      </button>
    </form>
  );
}

function HistoryModal({ row, weekStart, onClose }: { row: AbhyasiRow; weekStart: string; onClose: () => void }) {
  const history = useQuery({
    queryKey: ['abhyasiHistory', row.id, weekStart],
    queryFn: () => api<AbhyasiHistory>(`/api/preceptor/abhyasis/${row.id}/history?weekStart=${encodeURIComponent(weekStart)}`),
  });
  const chip = (e: Extract<AbhyasiHistory['entries'][number], { kind: 'mine' }>) => {
    if (e.status === 'cancelled') return { label: `cancelled by ${e.cancelledBy ?? 'unknown'}`, style: 'bg-stone-200 text-stone-500' };
    if (!e.ended) return { label: e.status === 'confirmed' ? 'upcoming · coming' : 'upcoming', style: 'bg-sky-100 text-sky-800' };
    return { label: 'sat with you', style: 'bg-emerald-100 text-emerald-800' };
  };
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{row.name}</h3>
            <p className="text-sm text-stone-500">
              {row.email} · linked {fmtDate(row.linkedAt)}
            </p>
            <span className={clsx('mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium', STATUS[row.status].style)}>
              {STATUS[row.status].label}
            </span>
          </div>
          <button className="rounded-lg p-1 hover:bg-stone-100" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <h4 className="mt-4 mb-1 text-sm font-semibold text-stone-600">History</h4>
        {history.data?.entries.length === 0 && <p className="text-sm text-stone-400">No bookings in this period.</p>}
        <ul className="divide-y divide-stone-100">
          {history.data?.entries.map((e, i) => (
            <li key={i} className="flex items-center justify-between py-1.5 text-sm">
              <span>
                {fmtDate(e.at)}
                {e.kind === 'mine' && <span className="ml-1 text-stone-500">{fmtTime(e.at)} · {e.durationMinutes} min</span>}
              </span>
              {e.kind === 'mine' ? (
                <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', chip(e).style)}>{chip(e).label}</span>
              ) : (
                <span className="rounded-full border border-emerald-600 px-2 py-0.5 text-xs font-medium text-emerald-800">sat elsewhere</span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-stone-400">Sittings with other preceptors show the date only.</p>
      </div>
    </div>
  );
}
