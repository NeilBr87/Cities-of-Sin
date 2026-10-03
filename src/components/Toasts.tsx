import { useSession } from '../state/SessionProvider';

export default function Toasts() {
  const { toasts } = useSession();
  if (toasts.length === 0) return null;
  return (
    <div className="toast-rail" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
      ))}
    </div>
  );
}
