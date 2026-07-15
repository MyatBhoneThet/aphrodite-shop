export function formatCurrency(value: number) {
  return `฿${Number(value || 0).toLocaleString()}`;
}

export function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
