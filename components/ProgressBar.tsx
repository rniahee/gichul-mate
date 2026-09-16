interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div>
      <div className="h-1.5 w-full bg-rule">
        <div className="h-1.5 bg-focus" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 font-mono text-sm text-ink/60">
        {current} / {total}
      </p>
    </div>
  );
}
