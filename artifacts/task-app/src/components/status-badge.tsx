interface StatusDef {
  name: string;
  label: string;
  color: string;
}

interface StatusBadgeProps {
  status?: string | null;
  statuses?: StatusDef[];
}

export function StatusBadge({ status, statuses }: StatusBadgeProps) {
  if (!status) return null;
  const def = statuses?.find((s) => s.name === status);
  const label = def?.label ?? status.replace(/_/g, " ");
  const color = def?.color ?? "#6b7280";

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full capitalize"
      style={{
        backgroundColor: `${color}20`,
        color,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: `${color}40`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
