import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

function getRemaining(targetIso: string) {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) {
    return { expired: true, hours: 0, minutes: 0, seconds: 0 };
  }
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { expired: false, hours, minutes, seconds };
}

export function CountdownTimer({ endTime }: { endTime: string }) {
  const [remaining, setRemaining] = useState(() => getRemaining(endTime));

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(getRemaining(endTime));
    }, 1000);
    return () => clearInterval(timer);
  }, [endTime]);

  if (remaining.expired) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
        <Clock className="h-3.5 w-3.5" />
        Drop Ended
      </span>
    );
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-800/40 bg-slate-950/85 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-sm">
      <Clock className="h-3.5 w-3.5 text-amber-400" />
      <span className="text-slate-300">Ends in</span>
      <span className="font-mono tabular-nums tracking-wider text-amber-300">
        {pad(remaining.hours)}:{pad(remaining.minutes)}:{pad(remaining.seconds)}
      </span>
    </div>
  );
}
