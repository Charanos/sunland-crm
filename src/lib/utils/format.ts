const kesFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

export function formatKES(value: number) {
  return kesFormatter.format(value);
}

export function formatCompactKES(value: number) {
  if (value >= 1_000_000) {
    return `KES ${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `KES ${(value / 1_000).toFixed(0)}K`;
  }

  return formatKES(value);
}
