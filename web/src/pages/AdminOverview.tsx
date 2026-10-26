import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { CLERK_ENABLED, api, type InviteResult } from '../api';

type Overview = { id: string; name: string; email: string; abhyasis: { id: string; name: string; email: string }[] }[];

export default function AdminOverview() {
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: ['adminOverview'], queryFn: () => api<Overview>('/api/admin/overview') });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');

  const create = useMutation({
    mutationFn: () => api<InviteResult>('/api/admin/preceptors', { method: 'POST', body: JSON.stringify({ name, email }) }),
    onSuccess: (r) => {
      setNote(
        r.invited
          ? `Invitation email sent to ${email.trim()}.${r.created ? '' : ' (The account already existed — the invitation was resent.)'}`
          : r.created
            ? `Preceptor account created for ${email.trim()}. No email goes out in local no-login mode.`
            : `${email.trim()} already has a preceptor account.`,
      );
      setName('');
      setEmail('');
      qc.invalidateQueries({ queryKey: ['adminOverview'] });
    },
    onError: (e) => setNote(e.message),
  });

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
          <span className="mb-1 block font-medium">Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-44 rounded-lg border border-stone-300 bg-white px-2 py-1.5" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Email</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-60 rounded-lg border border-stone-300 bg-white px-2 py-1.5" />
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

      {overview.data?.map((p) => (
        <div key={p.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="font-semibold">{p.name} <span className="ml-1 text-sm font-normal text-stone-500">{p.email}</span></div>
          <ul className="mt-2 list-inside list-disc text-sm text-stone-700">
            {p.abhyasis.map((a) => (
              <li key={a.id}>{a.name} — {a.email}</li>
            ))}
            {p.abhyasis.length === 0 && <li className="text-stone-400">No abhyasis linked</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}
