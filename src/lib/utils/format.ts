const kesFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

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
