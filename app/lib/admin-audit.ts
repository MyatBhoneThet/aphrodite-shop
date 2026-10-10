import { insertAuditLog } from "./supabase";

/**
 * Records an admin action in the audit log. It never throws: failing to write
 * the log must not undo or block the change the admin just made, so errors
 * are only reported to the server console.
 */
export async function recordAdminAction(entry: {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string | number;
  previous?: Record<string, unknown> | null;
  next?: Record<string, unknown> | null;
}) {
  try {
    await insertAuditLog({
      actor_id: entry.actorId,
      action: entry.action,
      target_type: entry.targetType,
      target_id: String(entry.targetId),
      previous_data: entry.previous ?? null,
      new_data: entry.next ?? null,
    });
  } catch (error) {
    console.error("[audit] could not record admin action", {
      action: entry.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const SCALAR_FIELDS = {
  name: "name",
  brand: "brand",
  category: "category",
  price: "price",
  wholesalePrice: "wholesale_price",
  stock: "stock",
  stockQuantity: "stock_quantity",
} as const;

/** Before/after for the short fields that matter in a log line; other edits are listed by name. */
export function productChange(before: Record<string, unknown> | null, input: Record<string, unknown>) {
  const previous: Record<string, unknown> = {};
  const next: Record<string, unknown> = {};
  const other: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const column = (SCALAR_FIELDS as Record<string, string>)[key];
    if (!column) {
      other.push(key);
      continue;
    }
    const was = before?.[column];
    if (before && was === value) continue;
    if (before) previous[column] = was ?? null;
    next[column] = value;
  }
  if (other.length) next.also_edited = other.join(", ");
  return { previous: Object.keys(previous).length ? previous : null, next };
}
