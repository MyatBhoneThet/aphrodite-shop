export function formatCurrency(value: number) {
  return `MMK ${Math.round(Number(value || 0)).toLocaleString("en-US")}`;
}

// Only use this for catalogue prices, never totals/refunds (zero is valid there).
export function formatProductPrice(value: number) {
  return Number.isFinite(value) && value > 0 ? formatCurrency(value) : "Price pending";
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
