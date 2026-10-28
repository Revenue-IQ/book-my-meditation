import clsx from 'clsx';

/** In-app replacement for window.confirm: styled, and testable where native dialogs are suppressed. */
export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = false,
  pending = false,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  /** Red confirm button for irreversible actions. */
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="whitespace-pre-line text-sm text-stone-600">{body}</p>
        <div className="flex justify-end gap-2">
          <button className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100" onClick={onClose}>
            Cancel
          </button>
          <button
            disabled={pending}
            className={clsx(
              'rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
              danger ? 'bg-red-700 hover:bg-red-800' : 'bg-emerald-700 hover:bg-emerald-800',
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
