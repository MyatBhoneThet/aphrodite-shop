/** Only the identifiers assigned to an order, never the full stock inventory. */
export type AssignedSerial = { code: string; serialNumber: string };

export function assignedSerials(units?: readonly AssignedSerial[] | null): AssignedSerial[] {
  const seen = new Set<string>();
  return (units ?? []).flatMap(unit => {
    if (typeof unit.code !== "string" || typeof unit.serialNumber !== "string") return [];
    const code = unit.code.trim(), serialNumber = unit.serialNumber.trim();
    const key = JSON.stringify([code, serialNumber]);
    if (!code || !serialNumber || seen.has(key)) return [];
    seen.add(key);
    return [{ code, serialNumber }];
  });
}

export function serialDescription(unit: AssignedSerial) {
  return `Code: ${unit.code} · S/N: ${unit.serialNumber}`;
}
