import { useMutation } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import { CLERK_ENABLED, api, timeZoneChoices, tzLabel } from '../api';

export type EditableUser = { id: string; firstName: string; lastName: string | null; email: string };

/**
 * Edit a user's name and email. `endpoint` is the PATCH route (preceptor and admin use
 * different ones). An email change moves the sign-in too — the server refuses the whole
 * edit if the Clerk side fails, so what's shown here never drifts from how people sign in.
 * `homeTimezone` (admin editing a preceptor only): shows the home-timezone picker; changing
 * it never moves existing slots, only how email times are worded.
 */
export default function EditUserModal({
  user,
  endpoint,
  homeTimezone: initialTz,
  onSaved,
  onClose,
}: {
  user: EditableUser;
  endpoint: string;
  homeTimezone?: string | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [email, setEmail] = useState(user.email);
  const [homeTimezone, setHomeTimezone] = useState(initialTz ?? '');
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () =>
      api(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ firstName, lastName, email, ...(initialTz != null && homeTimezone ? { homeTimezone } : {}) }),
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e.message),
  });
  const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase();

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form
        className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          save.mutate();
        }}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold">Edit {user.firstName}</h3>
          <button type="button" className="rounded-lg p-1 hover:bg-stone-100" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-3">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium">First name</span>
            <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-lg border border-stone-300 px-2 py-1.5" />
          </label>
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium">Last name <span className="font-normal text-stone-400">(optional)</span></span>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-lg border border-stone-300 px-2 py-1.5" />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Email</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-stone-300 px-2 py-1.5" />
        </label>

        {initialTz != null && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Home timezone</span>
            {/* Curated short list; the stored zone is always included so it can never be
                silently dropped (e.g. an alias like Asia/Calcutta, or an uncommon zone). */}
            <select value={homeTimezone} onChange={(e) => setHomeTimezone(e.target.value)} className="w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5">
              {timeZoneChoices(homeTimezone).map((tz) => (
                <option key={tz} value={tz}>{tzLabel(tz)}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-stone-500">
              Email times are worded in this zone. Existing sittings don't move — only how times are written.
            </span>
          </label>
        )}

        {emailChanged && CLERK_ENABLED && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Changing the email moves their sign-in: from now on they sign in with the new address. If they
            haven't signed in yet, a fresh invitation goes to the new address instead.
          </p>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={save.isPending} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
