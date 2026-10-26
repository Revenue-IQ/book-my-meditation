import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CalendarPlus, ChevronLeft, ChevronRight, Copy, Lock, Trash2, Users, X } from 'lucide-react';
import { useState } from 'react';
import { api, fmtDay, fmtTime, localDay, weekStartOf, type PreceptorSlot, type SlotBooking } from '../api';

// "No reply" is only alarming close to the sitting (inside the reminder window);
// before that, an unconfirmed booking is simply "planned".
function bookingChip(b: SlotBooking, windowOpen: boolean): { label: string; style: string } {
  if (b.status === 'confirmed') return { label: 'coming', style: 'bg-emerald-100 text-emerald-800' };
  if (b.status === 'cancelled')
    return { label: `cancelled${b.cancelledBy ? ` by ${b.cancelledBy}` : ''}`, style: 'bg-stone-200 text-stone-500 line-through' };
  return windowOpen
    ? { label: 'no reply', style: 'bg-amber-100 text-amber-800' }
    : { label: 'planned', style: 'bg-sky-100 text-sky-800' };
}

export default function PreceptorWeek() {
  const qc = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [detailSlotId, setDetailSlotId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ booking: SlotBooking; slot: PreceptorSlot } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Calendar arithmetic, not milliseconds: a week across a DST change is not 168 hours,
  // and +offset*168h would drift the week start off Monday midnight.
  const monday = weekStartOf(new Date());
  const weekStart = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + weekOffset * 7);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
  const weekKey = weekStart.toISOString();

  const slots = useQuery({
    queryKey: ['week', weekKey],
    queryFn: () =>
      api<PreceptorSlot[]>(
        `/api/preceptor/week?weekStart=${encodeURIComponent(weekKey)}&weekEnd=${encodeURIComponent(weekEnd.toISOString())}`,
      ),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['week'] });
  const onError = (e: Error) => {
    setNotice('');
    setError(e.message);
  };

  const copyWeek = useMutation({
    mutationFn: () => api<{ copied: number }>('/api/preceptor/copy-last-week', { method: 'POST', body: JSON.stringify({ weekStart: weekKey }) }),
    onSuccess: (r) => {
      setError('');
      setNotice(r.copied === 0 ? 'Nothing new to copy from last week.' : `Copied ${r.copied} slot${r.copied === 1 ? '' : 's'} from last week.`);
      refresh();
    },
    onError,
  });
  const deleteSlot = useMutation({
    mutationFn: (id: string) => api(`/api/preceptor/slots/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDetailSlotId(null);
      refresh();
    },
    onError,
  });
  const cancelBooking = useMutation({
    mutationFn: (p: { id: string; deleteSlot: boolean }) =>
      api(`/api/preceptor/bookings/${p.id}/cancel`, { method: 'POST', body: JSON.stringify({ deleteSlot: p.deleteSlot }) }),
    onSuccess: (_, p) => {
      setCancelTarget(null);
      if (p.deleteSlot) setDetailSlotId(null);
      refresh();
    },
    onError,
  });

  const days = [...Array(7)].map((_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));
  const detailSlot = slots.data?.find((s) => s.id === detailSlotId) ?? null;

  const onCreated = (slot: { startAt: string }) => {
    setShowForm(false);
    setError('');
    setNotice(`Slot created: ${fmtDay(new Date(slot.startAt))} · ${fmtTime(slot.startAt)}`);
    refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
          onClick={() => setShowForm((s) => !s)}
        >
          <CalendarPlus className="h-4 w-4" /> Add slot
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-100"
            onClick={() => copyWeek.mutate()}
            disabled={copyWeek.isPending}
          >
            <Copy className="h-4 w-4" /> Copy last week
          </button>
          {weekOffset !== 0 && (
            <button className="text-sm text-emerald-700 underline" onClick={() => setWeekOffset(0)}>
              today
            </button>
          )}
          <button className="rounded-lg border border-stone-300 p-1.5 hover:bg-stone-100" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-44 text-center font-medium">
            {fmtDay(days[0])} – {fmtDay(days[6])}
          </span>
          <button className="rounded-lg border border-stone-300 p-1.5 hover:bg-stone-100" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <p className="cursor-pointer rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" onClick={() => setError('')}>
          {error}
        </p>
      )}
      {notice && (
        <p className="cursor-pointer rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900" onClick={() => setNotice('')}>
          {notice}
        </p>
      )}

      {/* key: a fresh form per week, so the selected day always belongs to the visible week */}
      {showForm && <AddSlotForm key={weekKey} days={days} onDone={onCreated} onError={onError} />}

      <div className="space-y-4">
        {days.map((day) => {
          const daySlots = (slots.data ?? []).filter((s) => new Date(s.startAt).toDateString() === day.toDateString());
          if (daySlots.length === 0) return null;
          return (
            <section key={day.toISOString()}>
              <h3 className="mb-2 text-sm font-semibold text-stone-500">{fmtDay(day)}</h3>
              <div className="flex flex-wrap gap-2">
                {daySlots.map((slot) => {
                  const active = slot.bookings.filter((b) => b.status !== 'cancelled');
                  const anyNoReply = slot.confirmWindowOpen && active.some((b) => b.status === 'booked');
                  return (
                    <button
                      key={slot.id}
                      onClick={() => setDetailSlotId(slot.id)}
                      className="min-w-28 rounded-xl border border-stone-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-400 hover:shadow"
                    >
                      <div className="flex items-center gap-1.5 font-semibold">
                        {fmtTime(slot.startAt)}
                        {slot.visibility === 'restricted' && <Lock className="h-3.5 w-3.5 text-violet-600" />}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-stone-500">
                        <span>{slot.durationMinutes}m</span>
                        <span className={clsx('flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium',
                          active.length === 0 ? 'bg-stone-100 text-stone-500'
                          : anyNoReply ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800')}>
                          <Users className="h-3 w-3" /> {active.length}/{slot.capacity}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        {slots.data?.length === 0 && (
          <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
            No slots this week yet. Add one, or copy last week's plan.
          </p>
        )}
      </div>

      {detailSlot && !cancelTarget && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={() => setDetailSlotId(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {fmtDay(new Date(detailSlot.startAt))} · {fmtTime(detailSlot.startAt)}
                </h3>
                <p className="text-sm text-stone-500">
                  {detailSlot.durationMinutes} min · capacity {detailSlot.capacity}
                  {detailSlot.visibility === 'restricted' && <> · only {detailSlot.visibleTo.map((v) => v.name).join(', ')}</>}
                </p>
              </div>
              <button className="rounded-lg p-1 hover:bg-stone-100" onClick={() => setDetailSlotId(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <h4 className="mb-1 text-sm font-semibold text-stone-600">Bookings</h4>
              {detailSlot.bookings.length === 0 && <p className="text-sm text-stone-400">No bookings yet.</p>}
              <ul className="space-y-1.5">
                {detailSlot.bookings.map((b) => (
                  <li key={b.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {b.abhyasiName}
                      <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', bookingChip(b, detailSlot.confirmWindowOpen).style)}>
                        {bookingChip(b, detailSlot.confirmWindowOpen).label}
                      </span>
                    </span>
                    {b.status !== 'cancelled' && (
                      <button className="text-red-700 hover:underline" onClick={() => setCancelTarget({ booking: b, slot: detailSlot })}>
                        Cancel booking
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 flex items-center justify-end border-t border-stone-100 pt-3">
              {detailSlot.ended && detailSlot.bookings.some((b) => b.status !== 'cancelled') ? (
                <p className="text-xs text-stone-500">This sitting has happened and is kept as history. It cannot be deleted.</p>
              ) : (
                <button
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                  onClick={() => deleteSlot.mutate(detailSlot.id)}
                >
                  <Trash2 className="h-4 w-4" /> Delete slot
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={() => setCancelTarget(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">Cancel {cancelTarget.booking.abhyasiName}'s booking?</h3>
            <p className="mt-1 text-sm text-stone-600">
              {fmtTime(cancelTarget.slot.startAt)} · {cancelTarget.slot.durationMinutes} min. Choose what happens to the slot itself.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-100"
                onClick={() => cancelBooking.mutate({ id: cancelTarget.booking.id, deleteSlot: false })}
              >
                Cancel booking, keep slot open for others
              </button>
              {!cancelTarget.slot.ended && (
                <button
                  className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
                  onClick={() => cancelBooking.mutate({ id: cancelTarget.booking.id, deleteSlot: true })}
                >
                  Cancel booking and delete the slot
                </button>
              )}
              <button className="text-sm text-stone-500 hover:underline" onClick={() => setCancelTarget(null)}>
                Never mind
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddSlotForm({
  days,
  onDone,
  onError,
}: {
  days: Date[];
  onDone: (slot: { startAt: string }) => void;
  onError: (e: Error) => void;
}) {
  // Default to the next quarter-hour, not a fixed 7:00 AM: a default that is already in
  // the past turned every stray submit into a confusing "must be in the future" error.
  const firstStart = new Date(Math.ceil(Date.now() / 900000) * 900000);
  // Day picker: chips for the visible week instead of a native date input — the slot
  // lands in the week on screen (no more "created it but can't see it"), and Safari's
  // date-input calendar popup (which stays open after picking a day) is gone entirely.
  const todayKey = localDay();
  const dayChips = days.map((d) => {
    const key = localDay(d);
    return { key, label: fmtDay(d), past: key < todayKey };
  });
  const firstUsable = dayChips.find((d) => !d.past);
  const [date, setDate] = useState(firstUsable?.key ?? '');
  const [hour, setHour] = useState(((firstStart.getHours() + 11) % 12) + 1);
  const [minute, setMinute] = useState(firstStart.getMinutes());
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(firstStart.getHours() < 12 ? 'AM' : 'PM');
  const [duration, setDuration] = useState(45);
  const [capacity, setCapacity] = useState(1);
  const [restricted, setRestricted] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const abhyasis = useQuery({
    queryKey: ['linkedAbhyasis'],
    queryFn: () => api<{ id: string; name: string }[]>('/api/preceptor/abhyasis'),
  });

  const create = useMutation({
    mutationFn: () => {
      const [y, m, d] = date.split('-').map(Number);
      const h24 = (hour % 12) + (ampm === 'PM' ? 12 : 0);
      const startAt = new Date(y, m - 1, d, h24, minute); // local time → UTC on the wire
      if (startAt.getTime() <= Date.now())
        throw new Error('That time has already passed today — pick a later time or another day.');
      return api<{ startAt: string }>('/api/preceptor/slots', {
        method: 'POST',
        body: JSON.stringify({
          startAt: startAt.toISOString(),
          durationMinutes: duration,
          capacity,
          visibleTo: restricted ? selected : 'all',
        }),
      });
    },
    onSuccess: onDone,
    onError,
  });

  return (
    <form
      className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <div className="text-sm">
        <span className="mb-1 block font-medium">Day</span>
        <div className="flex flex-wrap gap-1.5">
          {dayChips.map((d) => (
            <button
              key={d.key}
              type="button"
              disabled={d.past}
              onClick={() => setDate(d.key)}
              className={clsx(
                'rounded-full border px-2.5 py-1',
                d.past ? 'cursor-not-allowed border-stone-200 text-stone-300'
                : date === d.key ? 'border-emerald-500 bg-emerald-100 font-medium text-emerald-900'
                : 'border-stone-300 bg-white hover:bg-stone-50',
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        {!firstUsable && <p className="mt-2 text-stone-500">This week is over — switch to a current week to add slots.</p>}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Start time</span>
          <span className="flex items-center gap-1">
            <select value={hour} onChange={(e) => setHour(Number(e.target.value))} className="h-9 w-16 rounded-lg border border-stone-300 px-2">
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
            :
            <select value={minute} onChange={(e) => setMinute(Number(e.target.value))} className="h-9 w-16 rounded-lg border border-stone-300 px-2">
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
              ))}
            </select>
            <select value={ampm} onChange={(e) => setAmpm(e.target.value as 'AM' | 'PM')} className="h-9 w-18 rounded-lg border border-stone-300 px-2">
              <option>AM</option>
              <option>PM</option>
            </select>
          </span>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Duration (min)</span>
          <input type="number" min={5} max={240} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="h-9 w-20 rounded-lg border border-stone-300 px-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Capacity</span>
          <input type="number" min={1} max={50} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="h-9 w-16 rounded-lg border border-stone-300 px-2" />
        </label>
      </div>

      <div className="text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} />
          <span className="font-medium">Only visible to specific abhyasis</span>
        </label>
        {restricted && (
          <div className="mt-2 flex flex-wrap gap-2">
            {abhyasis.data?.map((a) => (
              <label key={a.id} className={clsx('cursor-pointer rounded-full border px-3 py-1', selected.includes(a.id) ? 'border-violet-400 bg-violet-100 text-violet-900' : 'border-stone-300 bg-white')}>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={selected.includes(a.id)}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, a.id] : s.filter((x) => x !== a.id)))}
                />
                {a.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={create.isPending || !date}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-stone-300"
      >
        Create slot
      </button>
    </form>
  );
}
