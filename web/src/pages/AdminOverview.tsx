import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, RotateCcw, Trash2, UserPlus, UserX } from 'lucide-react';
import { useState } from 'react';
import { CLERK_ENABLED, api, detectTimeZone, timeZoneChoices, tzLabel, type InviteResult } from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import EditUserModal, { type EditableUser } from '../components/EditUserModal';

type AdminUser = EditableUser & { name: string; deactivatedAt: string | null; homeTimezone?: string | null };
type Overview = {
  preceptors: (AdminUser & { abhyasis: AdminUser[] })[];
  unlinkedAbhyasis: AdminUser[];
};

export default function AdminOverview() {
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: ['adminOverview'], queryFn: () => api<Overview>('/api/admin/overview') });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  // The preceptor's HOME timezone (Phase 5): emails word sitting times in it. Pre-filled
  // with the browser's zone so the common case is one glance, not a 400-entry search.
  const [homeTimezone, setHomeTimezone] = useState(detectTimeZone());
  const [note, setNote] = useState('');
  const [edit, setEdit] = useState<{ user: AdminUser; role: 'preceptor' | 'abhyasi' } | null>(null);
  const [confirm, setConfirm] = useState<{ user: AdminUser; kind: 'deactivate' | 'delete' ; role: 'preceptor' | 'abhyasi' } | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['adminOverview'] });

  const create = useMutation({
    mutationFn: () =>
      api<InviteResult>('/api/admin/preceptors', { method: 'POST', body: JSON.stringify({ firstName, lastName, email, homeTimezone }) }),
    onSuccess: (r) => {
      setNote(
        r.invited
          ? `Invitation email sent to ${email.trim()}.${r.created ? '' : ' (The account already existed — the invitation was resent.)'}`
          : r.created
            ? `Preceptor account created for ${email.trim()}. No email goes out in local no-login mode.`
            : `${email.trim()} already has a preceptor account.`,
      );
      setFirstName('');
      setLastName('');
      setEmail('');
      refresh();
    },
    onError: (e) => setNote(e.message),
  });

  const deactivate = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) =>
      api(`/api/admin/users/${id}/${on ? 'deactivate' : 'reactivate'}`, { method: 'POST' }),
    onSuccess: (_r, { on }) => {
      setNote(on ? 'Deactivated. They can no longer sign in and their slots are hidden; all history stays.' : 'Reactivated.');
      setConfirm(null);
      refresh();
    },
    onError: (e) => {
      setConfirm(null);
      setNote(e.message);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setNote('Deleted permanently, along with everything that belonged to them.');
      setConfirm(null);
      refresh();
    },
    onError: (e) => {
      setConfirm(null);
      setNote(e.message);
    },
  });

  const userActions = (u: AdminUser, role: 'preceptor' | 'abhyasi') => (
    <div className="flex gap-1">
      <button title="Edit name or email" className="rounded-lg p-1.5 hover:bg-stone-100" onClick={() => setEdit({ user: u, role })}>
        <Pencil className="h-4 w-4" />
      </button>
      {role === 'preceptor' &&
        (u.deactivatedAt ? (
          <button title="Reactivate" className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-50" onClick={() => deactivate.mutate({ id: u.id, on: false })}>
            <RotateCcw className="h-4 w-4" />
          </button>
        ) : (
          <button
            title="Deactivate (keeps history)"
            className="rounded-lg p-1.5 text-amber-700 hover:bg-amber-50"
            onClick={() => setConfirm({ user: u, kind: 'deactivate', role })}
          >
            <UserX className="h-4 w-4" />
          </button>
        ))}
      <button
        title="Delete permanently"
        className="rounded-lg p-1.5 text-red-700 hover:bg-red-50"
        onClick={() => setConfirm({ user: u, kind: 'delete', role })}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Preceptors and their abhyasis</h2>

      <form
        className="flex flex-wrap items-end gap-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setNote('');
          create.mutate();
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
        <label className="text-sm">
          <span className="mb-1 block font-medium">Home timezone</span>
          <select value={homeTimezone} onChange={(e) => setHomeTimezone(e.target.value)} className="h-[38px] w-60 rounded-lg border border-stone-300 bg-white px-2 py-1.5">
            {timeZoneChoices(detectTimeZone()).map((tz) => (
              <option key={tz} value={tz}>{tzLabel(tz)}</option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={create.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" /> Create preceptor
        </button>
        <p className="basis-full text-xs text-stone-500">
          {CLERK_ENABLED
            ? 'They get an invitation email; the account activates when they accept and sign in.'
            : 'Local no-login mode: the account appears in the role switcher, no email is sent.'}
        </p>
      </form>
      {note && (
        <p className="cursor-pointer rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" onClick={() => setNote('')}>
          {note}
        </p>
      )}

      {overview.data?.preceptors.map((p) => (
        <div key={p.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="font-semibold">
              {p.name} <span className="ml-1 text-sm font-normal text-stone-500">{p.email}</span>
              {p.homeTimezone && <span className="ml-2 text-xs font-normal text-stone-400">{p.homeTimezone}</span>}
              {p.deactivatedAt && (
                <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600">deactivated</span>
              )}
            </div>
            {userActions(p, 'preceptor')}
          </div>
          <ul className="mt-2 text-sm text-stone-700">
            {p.abhyasis.map((a) => (
              <li key={a.id} className="flex items-center justify-between border-t border-stone-100 py-1 first:border-t-0">
                <span>
                  {a.name} <span className="text-stone-500">— {a.email}</span>
                </span>
                {userActions(a, 'abhyasi')}
              </li>
            ))}
            {p.abhyasis.length === 0 && <li className="py-1 text-stone-400">No abhyasis linked</li>}
          </ul>
        </div>
      ))}

      {overview.data && overview.data.unlinkedAbhyasis.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="font-semibold">Abhyasis without a preceptor</div>
          <p className="text-xs text-stone-500">Unlinked by every preceptor. They can still sign in; only you can see or delete them here.</p>
          <ul className="mt-2 text-sm text-stone-700">
            {overview.data.unlinkedAbhyasis.map((a) => (
              <li key={a.id} className="flex items-center justify-between border-t border-stone-100 py-1 first:border-t-0">
                <span>
                  {a.name} <span className="text-stone-500">— {a.email}</span>
                </span>
                {userActions(a, 'abhyasi')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {confirm && confirm.kind === 'deactivate' && (
        <ConfirmDialog
          title={`Deactivate ${confirm.user.name}?`}
          body="They can no longer sign in and their slots disappear for abhyasis. All history stays, and you can reactivate them any time."
          confirmLabel="Deactivate"
          pending={deactivate.isPending}
          onConfirm={() => deactivate.mutate({ id: confirm.user.id, on: true })}
          onClose={() => setConfirm(null)}
        />
      )}

      {confirm && confirm.kind === 'delete' && (
        <ConfirmDialog
          title={`Delete ${confirm.user.name} permanently?`}
          body={
            confirm.role === 'preceptor'
              ? 'This removes their account, sign-in, slots and every booking on them — abhyasis lose those sittings from their history. This cannot be undone.\n\nIf they simply left, use Deactivate instead.'
              : 'This removes their account, sign-in, bookings and check-ins. This cannot be undone.'
          }
          confirmLabel="Delete permanently"
          danger
          pending={remove.isPending}
          onConfirm={() => remove.mutate(confirm.user.id)}
          onClose={() => setConfirm(null)}
        />
      )}

      {edit && (
        <EditUserModal
          user={edit.user}
          endpoint={`/api/admin/users/${edit.user.id}`}
          homeTimezone={edit.role === 'preceptor' ? edit.user.homeTimezone ?? 'Asia/Kolkata' : undefined}
          onSaved={() => {
            setEdit(null);
            refresh();
          }}
          onClose={() => setEdit(null)}
        />
      )}
    </div>
  );
}
