interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div>
      <div className="h-2 w-full rounded bg-gray-200">
        <div className="h-2 rounded bg-blue-500" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-sm text-gray-500">
        {current} / {total}
      </p>
    </div>
  );
}
