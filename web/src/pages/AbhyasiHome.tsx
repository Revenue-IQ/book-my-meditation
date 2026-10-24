import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CheckCircle2, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDay, fmtTime, localDay, type CheckinPage, type MyBooking, type VisibleSlot } from '../api';

export default function AbhyasiHome() {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [detailSlotId, setDetailSlotId] = useState<string | null>(null);

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
        {slots.data?.length === 0 && <p className="text-sm text-stone-500">No upcoming slots from your preceptors right now.</p>}
        <div className="space-y-4">
          {[...byDay.entries()].map(([day, daySlots]) => (
            <div key={day}>
              <h3 className="mb-2 text-sm font-semibold text-stone-500">{fmtDay(new Date(day))}</h3>
              <div className="flex flex-wrap gap-2">
                {daySlots.map((s) => {
                  const left = s.capacity - s.activeBookings;
                  const full = !s.myBookingId && left <= 0;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setDetailSlotId(s.id)}
                      className={clsx(
                        'min-w-28 rounded-xl border p-3 text-left shadow-sm transition',
                        s.myBookingId
                          ? 'border-emerald-300 bg-emerald-50 hover:border-emerald-400'
                          : full
                            ? 'border-stone-200 bg-stone-100 text-stone-400'
                            : 'border-stone-200 bg-white hover:border-emerald-400 hover:shadow',
                      )}
                    >
                      <div className="font-semibold">{fmtTime(s.startAt)}</div>
                      <div className="mt-1 text-xs text-stone-500">{s.preceptorName}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs">
                        {s.myBookingId ? (
                          <span className="font-medium text-emerald-700">Booked ✓</span>
                        ) : full ? (
                          <span>Full</span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-stone-500">
                            <Users className="h-3 w-3" /> {left}/{s.capacity} left
                          </span>
                        )}
                        {s.visibility === 'restricted' && (
                          <span className="rounded-full bg-violet-100 px-1.5 py-0.5 font-medium text-violet-800">for you</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
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
