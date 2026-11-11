import { assignedSerials, serialDescription, type AssignedSerial } from "../lib/serial-allocations";

export default function AssignedSerials({ units, className = "mt-2 space-y-1 text-xs text-zinc-500" }: {
  units?: readonly AssignedSerial[] | null;
  className?: string;
}) {
  const assigned = assignedSerials(units);
  if (!assigned.length) return null;
  return <ul aria-label="Assigned laptop codes and serial numbers" className={className}>
    {assigned.map(unit => <li key={`${unit.code}:${unit.serialNumber}`} className="break-words">{serialDescription(unit)}</li>)}
  </ul>;
}
