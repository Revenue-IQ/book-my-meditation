import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type EmailPrefs } from '../api';

const RECEIVE_LABELS: { key: keyof EmailPrefs; label: string; hint: string }[] = [
  { key: 'receiveAnnouncement', label: 'New slots', hint: 'when a preceptor publishes slots you can book' },
  { key: 'receiveConfirmation', label: 'Booking confirmed', hint: 'when a sitting is booked' },
  { key: 'receiveCancellation', label: 'Booking cancelled', hint: 'when a sitting is cancelled' },
  { key: 'receiveReminder', label: 'Reminder', hint: 'before the sitting, with one-click confirm / cancel' },
];

/**
 * The signed-in user's email RECEIVE toggles (any role). Each switch saves on its own —
 * there is no master switch, per spec. Defaults are all ON.
 */
export default function EmailPrefsPanel({ onError }: { onError?: (e: Error) => void }) {
  const qc = useQueryClient();
  const prefs = useQuery({ queryKey: ['emailPrefs'], queryFn: () => api<EmailPrefs>('/api/me/email-prefs') });
  const toggle = useMutation({
    mutationFn: (patch: Partial<EmailPrefs>) => api<EmailPrefs>('/api/me/email-prefs', { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: (data) => qc.setQueryData(['emailPrefs'], data),
    onError,
  });

  if (!prefs.data) return null;
  return (
    <div className="space-y-1.5">
      {RECEIVE_LABELS.map(({ key, label, hint }) => (
        <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={prefs.data[key]}
            disabled={toggle.isPending}
            onChange={(e) => toggle.mutate({ [key]: e.target.checked })}
          />
          <span className="font-medium">{label}</span>
          <span className="text-xs text-stone-500">— {hint}</span>
        </label>
      ))}
    </div>
  );
}
