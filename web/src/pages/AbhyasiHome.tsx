import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CheckCircle2, ChevronDown, ChevronRight, Mail, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDay, fmtTime, localDay, type CheckinPage, type MyBooking, type VisibleSlot } from '../api';
import EmailPrefsPanel from '../components/EmailPrefsPanel';

export default function AbhyasiHome() {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [detailSlotId, setDetailSlotId] = useState<string | null>(null);
  const [showEmailPrefs, setShowEmailPrefs] = useState(false);

  const slots = useQuery({ queryKey: ['visibleSlots'], queryFn: () => api<VisibleSlot[]>('/api/abhyasi/slots') });
  const mine = useQuery({ queryKey: ['myBookings'], queryFn: () => api<MyBooking[]>('/api/abhyasi/bookings') });
  const today = localDay();
  const checkin = useQuery({ queryKey: ['checkin', today], queryFn: () => api<CheckinPage>(`/api/abhyasi/checkin?today=${today}`) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['visibleSlots'] });
    qc.invalidateQueries({ queryKey: ['myBookings'] });
  };
  const onError = (e: Error) => {
    setError(e.message);
    refresh(); // someone may have taken the spot — show fresh counts
  };

  const book = useMutation({
    mutationFn: (slotId: string) => api('/api/abhyasi/bookings', { method: 'POST', body: JSON.stringify({ slotId }) }),
    onSuccess: () => { setError(''); setDetailSlotId(null); refresh(); },
    onError,
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api(`/api/abhyasi/bookings/${id}/cancel`, { method: 'POST', body: '{}' }),
    onSuccess: refresh,
    onError,
  });
  const confirm = useMutation({
    mutationFn: (id: string) => api(`/api/abhyasi/bookings/${id}/confirm`, { method: 'POST', body: '{}' }),
    onSuccess: refresh,
    onError,
  });

  const byDay = new Map<string, VisibleSlot[]>();
  for (const s of slots.data ?? []) {
    const key = new Date(s.startAt).toDateString();
    byDay.set(key, [...(byDay.get(key) ?? []), s]);
  }
  const detailSlot = slots.data?.find((s) => s.id === detailSlotId) ?? null;
  const spotsLeft = detailSlot ? detailSlot.capacity - detailSlot.activeBookings : 0;

  // Page-at-a-glance numbers for the summary strip (same pattern as the preceptor week).
  const myUpcoming = mine.data ?? [];
  const nextBooking = [...myUpcoming].sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
  const confirmNow = myUpcoming.filter((b) => b.status === 'booked' && b.confirmWindowOpen).length;
  const openSlots = (slots.data ?? []).filter((s) => !s.myBookingId && s.capacity - s.activeBookings > 0).length;

  // The next 7 days always render (stable shape, like the preceptor week view); any
  // published slots further out get their own rows appended below.
  const now = new Date();
  const next7 = [...Array(7)].map((_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i));
  const next7Keys = new Set(next7.map((d) => d.toDateString()));
  const laterDays = [...byDay.keys()]
    .filter((k) => !next7Keys.has(k))
    .map((k) => new Date(k))
    .sort((a, b) => a.getTime() - b.getTime());
  const dayList = [...next7, ...laterDays];

  return (
    <div className="space-y-8">
      {checkin.data && !checkin.data.today && (
        <Link
          to="/abhyasi/checkin"
          className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 hover:bg-violet-100"
        >
          <span>
            <span className="font-medium">How are you today?</span> Take a moment for your daily check-in.
          </span>
          <span className="text-lg" aria-hidden>🙂</span>
        </Link>
      )}
      {error && (
        <p className="cursor-pointer rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" onClick={() => setError('')}>
          {error}
        </p>
      )}

      {mine.data && slots.data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs text-stone-400">Next sitting</p>
            {nextBooking ? (
              <p className="mt-0.5 text-sm font-semibold">
                {fmtDay(new Date(nextBooking.startAt))} · {fmtTime(nextBooking.startAt)}
                <span className="font-normal text-stone-500"> · with {nextBooking.preceptorName}</span>
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-stone-400">Nothing booked</p>
            )}
          </div>
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs text-stone-400">Open slots</p>
            {openSlots > 0 ? (
              <p className="mt-0.5 text-sm font-semibold">
                {openSlots} you can book
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-stone-400">None right now</p>
            )}
          </div>
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs text-stone-400">Needs action</p>
            {confirmNow > 0 ? (
              <p className="mt-0.5 text-sm font-semibold text-amber-700">
                Confirm {confirmNow} sitting{confirmNow === 1 ? '' : 's'} below
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-stone-400">Nothing pending</p>
            )}
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-base font-semibold">My upcoming sittings</h2>
        {mine.data?.length === 0 && <p className="text-sm text-stone-500">Nothing booked yet — pick a slot below.</p>}
        <div className="space-y-2">
          {mine.data?.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div>
                <span className="font-semibold">{fmtDay(new Date(b.startAt))} · {fmtTime(b.startAt)}</span>
                <span className="ml-2 text-sm text-stone-500">{b.durationMinutes} min with {b.preceptorName}</span>
                {b.status === 'confirmed' && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    <CheckCircle2 className="h-3 w-3" /> you're coming
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {b.status === 'booked' && b.confirmWindowOpen && (
                  <button
                    className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
                    onClick={() => confirm.mutate(b.id)}
                  >
                    I'm coming
                  </button>
                )}
                <button
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
                  onClick={() => cancel.mutate(b.id)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Available slots</h2>
        {slots.data?.length === 0 && (
          <p className="mb-3 text-sm text-stone-500">No upcoming slots from your preceptors right now.</p>
        )}
        {/* Every day of the next week renders, slots or not: the list keeps a stable
            7-row shape instead of collapsing to a couple of floating sections. */}
        <div>
          {dayList.map((day) => {
            const key = day.toDateString();
            const isToday = localDay(day) === today;
            const daySlots = (byDay.get(key) ?? []).sort((a, b) => a.startAt.localeCompare(b.startAt));
            return (
              <div key={key} className="flex items-center gap-4 border-t border-stone-200 py-2.5 last:border-b">
                <h3
                  className={clsx(
                    'w-20 shrink-0 text-sm',
                    isToday ? 'font-semibold text-emerald-700' : daySlots.length === 0 ? 'text-stone-400' : 'font-medium text-stone-600',
                  )}
                >
                  {day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                  {isToday && <span className="block text-xs font-normal text-emerald-600">today</span>}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  {daySlots.map((s) => {
                    const left = s.capacity - s.activeBookings;
                    const full = !s.myBookingId && left <= 0;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setDetailSlotId(s.id)}
                        className={clsx(
                          'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left shadow-sm transition',
                          s.myBookingId
                            ? 'border-emerald-300 bg-emerald-50 hover:border-emerald-400'
                            : full
                              ? 'border-stone-200 bg-stone-100 text-stone-400'
                              : 'border-stone-200 bg-white hover:border-emerald-400 hover:shadow',
                        )}
                      >
                        <span className="text-sm font-semibold">{fmtTime(s.startAt)}</span>
                        <span className="text-xs text-stone-500">{s.preceptorName}</span>
                        {s.myBookingId ? (
                          <span className="text-xs font-medium text-emerald-700">Booked ✓</span>
                        ) : full ? (
                          <span className="text-xs">Full</span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-xs text-stone-500">
                            <Users className="h-3 w-3" /> {left}/{s.capacity} left
                          </span>
                        )}
                        {s.visibility === 'restricted' && (
                          <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-800">for you</span>
                        )}
                      </button>
                    );
                  })}
                  {daySlots.length === 0 && <span className="text-xs text-stone-300">—</span>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-stone-400">Times are shown in your local timezone.</p>
      </section>

      <section>
        <button
          className="flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900"
          onClick={() => setShowEmailPrefs((s) => !s)}
        >
          {showEmailPrefs ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Mail className="h-4 w-4" /> Email preferences
        </button>
        {showEmailPrefs && (
          <div className="mt-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <EmailPrefsPanel onError={(e) => setError(e.message)} />
          </div>
        )}
      </section>

      {detailSlot && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={() => setDetailSlotId(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {fmtDay(new Date(detailSlot.startAt))} · {fmtTime(detailSlot.startAt)}
                </h3>
                <p className="text-sm text-stone-500">
                  {detailSlot.durationMinutes} min with {detailSlot.preceptorName}
                  <> · {detailSlot.capacity} {detailSlot.capacity === 1 ? 'person' : 'people'} can attend · {spotsLeft} left</>
                  {detailSlot.visibility === 'restricted' && <> · reserved for you</>}
                </p>
              </div>
              <button className="rounded-lg p-1 hover:bg-stone-100" onClick={() => setDetailSlotId(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {detailSlot.myBookingId ? (
                <>
                  {detailSlot.myBookingStatus === 'confirmed' ? (
                    <p className="text-sm font-medium text-emerald-700">You're booked and confirmed for this sitting. 🙏</p>
                  ) : detailSlot.confirmWindowOpen ? (
                    <button
                      className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                      onClick={() => confirm.mutate(detailSlot.myBookingId!, { onSuccess: refresh })}
                    >
                      I'm coming
                    </button>
                  ) : (
                    <p className="text-sm text-stone-600">
                      You're booked. Closer to the sitting we'll ask you to confirm you're coming.
                    </p>
                  )}
                  <button
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100"
                    onClick={() => cancel.mutate(detailSlot.myBookingId!, { onSuccess: () => setDetailSlotId(null) })}
                  >
                    Cancel my booking
                  </button>
                </>
              ) : spotsLeft > 0 ? (
                <button
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                  onClick={() => book.mutate(detailSlot.id)}
                  disabled={book.isPending}
                >
                  Book this slot
                </button>
              ) : (
                <p className="text-sm text-stone-500">This slot is full.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
