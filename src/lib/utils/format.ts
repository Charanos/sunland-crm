export function formatKES(value: number) {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  return `${isNegative ? "-" : ""}KES ${absValue.toLocaleString("en-KE")}`;
}

export function formatCompactKES(value: number) {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const sign = isNegative ? "-" : "";

  if (absValue >= 1_000_000) {
    return `${sign}KES ${(absValue / 1_000_000).toFixed(1)}M`;
  }

  if (absValue >= 1_000) {
    return `${sign}KES ${(absValue / 1_000).toFixed(0)}K`;
  }

  return formatKES(value);
}

export function formatFileSize(bytes: number | null | undefined): string | null {
  if (bytes == null || bytes <= 0) return null;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}
