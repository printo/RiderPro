import { useState } from "react";
import { Link } from "wouter";
import { useDayPlan } from "@/hooks/useDayPlan";
import type { DayPlanWave, DayPlanRider } from "@shared/types";

/** Local YYYY-MM-DD for the default date (avoids UTC off-by-one). */
function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatClock(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const WAVES: { value: DayPlanWave; label: string }[] = [
  { value: "all", label: "All day" },
  { value: "morning", label: "Morning" },
  { value: "noon", label: "Noon" },
  { value: "evening", label: "Evening" },
];

export default function OpsDayView() {
  const [date, setDate] = useState<string>(todayISO());
  const [wave, setWave] = useState<DayPlanWave>("all");
  const { data, isLoading, isError, error, refetch, isFetching } = useDayPlan(date, wave);

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ops Day Plan</h1>
          <p className="text-sm text-muted-foreground">
            Read-only oversight — each rider's road-ordered route, ETAs and problem flags before dispatch.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
          <select
            value={wave}
            onChange={(e) => setWave(e.target.value as DayPlanWave)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            {WAVES.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading the day plan…</div>}
      {isError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Couldn't load the day plan{error instanceof Error ? `: ${error.message}` : ""}.
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryTile label="Riders" value={data.totals.rider_count} />
            <SummaryTile label="Shipments" value={data.totals.shipment_count} />
            <SummaryTile label="Unassigned" value={data.totals.unassigned_count} warn />
            <SummaryTile label="Overloaded" value={data.totals.overloaded_rider_count} warn />
            <SummaryTile label="Pincode overlaps" value={data.totals.overlap_pincode_count} warn />
          </div>

          {data.overlaps.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h2 className="text-sm font-semibold text-amber-800">
                Pincode overlaps — riders covering the same area
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {data.overlaps.map((o) => (
                  <li key={o.pincode}>
                    <span className="font-medium">{o.pincode}</span>: {o.rider_ids.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            {data.riders.map((r) => (
              <RiderCard key={r.employee_id} rider={r} />
            ))}
            {data.riders.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No riders with shipments for this date / wave.
              </div>
            )}
          </div>

          {data.unassigned.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">
                Unassigned shipments ({data.unassigned.length})
              </h2>
              <ul className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                {data.unassigned.map((u) => (
                  <li key={u.shipment_id}>
                    #{u.shipment_id} · {u.customer_name}
                    {u.pincode ? ` · ${u.pincode}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryTile({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className={`text-2xl font-bold ${warn && value > 0 ? "text-amber-600" : "text-foreground"}`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function RiderCard({ rider }: { rider: DayPlanRider }) {
  const t = rider.totals;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">{rider.rider_name}</h3>
          {rider.flags.overloaded && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              Overloaded
            </span>
          )}
          <Link
            href={`/live-tracking?focus=${rider.employee_id}`}
            className="text-xs font-medium text-blue-600 hover:underline"
            title="See this rider live"
          >
            View live →
          </Link>
        </div>
        <div className="text-sm text-muted-foreground">
          {t.stop_count} stops · {t.total_km} km · ~{t.est_duration_min} min · finish {formatClock(t.finish_eta_clock)}
        </div>
      </div>

      {rider.flags.overloaded && rider.flags.reasons.length > 0 && (
        <p className="mt-1 text-xs text-amber-700">{rider.flags.reasons.join("; ")}</p>
      )}
      {t.unmappable_count > 0 && (
        <p className="mt-1 text-xs text-red-600">
          {t.unmappable_count} shipment(s) have no map location and aren't routed.
        </p>
      )}

      {rider.stops.length > 0 && (
        <ol className="mt-3 divide-y divide-border rounded-md border border-border">
          {rider.stops.map((s) => (
            <li key={s.shipment_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {s.sequence}
                </span>
                <span className="font-medium text-foreground">{s.customer_name}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    s.type === "pickup" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                  }`}
                >
                  {s.type}
                </span>
                {s.pincode && <span className="text-xs text-muted-foreground">{s.pincode}</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                {s.distance_from_previous_km > 0 ? `${s.distance_from_previous_km} km · ` : ""}
                ETA {formatClock(s.eta_clock)} (~{s.eta_minutes}m)
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
