"use client";

import { useEffect, useMemo, useState } from "react";

type MonthlyWeeklyBlock = {
  revenue: { target: number | null; actual: number | null };
  quotesCount: { target: number | null; actual: number | null };
  quotesValue: { target: number | null; actual: number | null };
  sourceRow: number;
};

type DashboardData = {
  salesYTD: number | null;
  salesGoalAnnual: number | null;
  percentOfGoal: number | null;
lastYearRevenue: number | null;
  conversionRate: number | null;
  
  ytdActualRevenue: number;
  ytdExpectedRevenue: number;

  monthly: ({ month: string } & MonthlyWeeklyBlock) | null;
  weekly: ({ weekEnding: string } & MonthlyWeeklyBlock) | null;

  fetchedAt: string;
};

function formatMoney(n: number | null) {
  if (n === null) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatInt(n: number | null) {
  if (n === null) return "—";
  return Math.round(n).toLocaleString();
}

function formatPercent(n: number | null) {
  if (n === null) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(n);
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--pe-card)] p-5 shadow-sm border border-black/5 min-w-0">
      <div className="text-sm font-semibold tracking-wide text-black/60">
        {label}
      </div>
      <div className="mt-2 font-extrabold leading-none text-[var(--pe-black)] tracking-tight whitespace-nowrap text-[clamp(1.1rem,3.2vw,1.9rem)]">
        {value}
      </div>
    </div>
  );
}

function getStatus(actual: number | null, target: number | null) {
  if (actual == null || target == null || target === 0) return "On Pace" as const;
  const ratio = actual / target;

  if (ratio >= 1.05) return "Ahead" as const;
  if (ratio <= 0.95) return "Behind" as const;
  return "On Pace" as const;
}

function StatusChip({
  status,
}: {
  status: "Ahead" | "On Pace" | "Behind";
}) {
  const styles =
    status === "Ahead"
      ? "bg-green-100 text-green-900 border-green-200"
      : status === "Behind"
      ? "bg-red-100 text-red-900 border-red-200"
      : "bg-yellow-100 text-yellow-900 border-yellow-200";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${styles}`}
    >
      <span className="h-2 w-2 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

function MetricRow({
  title,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  status,
  accent = "orange",
}: {
  title: string;
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
  status: "Ahead" | "On Pace" | "Behind";
  accent?: "orange" | "black";
}) {
  const accentBar =
    accent === "orange" ? "bg-[var(--pe-orange)]" : "bg-[var(--pe-black)]";

  return (
    <div className="rounded-2xl bg-[var(--pe-card)] p-5 shadow-sm border border-black/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-black/70">{title}</div>

          <div className="mt-3 flex items-end justify-between gap-8">
  <div className="max-w-[45%]">
    <div className="text-xs font-semibold text-black/50">{leftLabel}</div>
    <div className="mt-1 text-lg font-extrabold text-[var(--pe-black)]">
      {leftValue}
    </div>
  </div>

  <div className="ml-auto text-right">
    <div className="text-xs font-semibold text-black/50">{rightLabel}</div>
    <div className="mt-1 text-lg font-extrabold text-[var(--pe-black)]">
      {rightValue}
    </div>
  </div>
</div>
        </div>

        <StatusChip status={status} />
      </div>

      {(() => {
  const actualNum = Number(leftValue?.replace(/[^0-9.-]+/g, ""));
  const goalNum = Number(rightValue?.replace(/[^0-9.-]+/g, ""));
  const ratio =
    !isNaN(actualNum) && !isNaN(goalNum) && goalNum > 0
      ? Math.min(actualNum / goalNum, 1.4)
      : 0;

  return (
    <div className="mt-4 h-2 w-full rounded-full bg-black/10 overflow-hidden">
      <div
        className={`h-full ${accentBar} rounded-full transition-all duration-500`}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
})()}
    </div>
  );
}

function PaceBar({
  actualYTD,
  expectedYTD,
}: {
  actualYTD: number | null;
  expectedYTD: number | null;
}) {
  const actual = actualYTD ?? null;
  const expected = expectedYTD ?? null;

  if (actual == null || expected == null || expected === 0) {
    return (
      <div className="rounded-2xl bg-[var(--pe-card)] p-5 shadow-sm border border-black/5">
        <div className="text-sm font-semibold tracking-wide text-black/60">
          Pace Status
        </div>
        <div className="mt-2 text-sm text-black/60">—</div>
      </div>
    );
  }

  const ratio = actual / expected; // 1.0 = on pace
  const pct = ratio * 100;

  // Color logic:
  // Red: < 95%
  // Green: 95–115%
  // Orange: > 115%
  const status =
    ratio < 0.95 ? "Below Pace" : ratio > 1.15 ? "Way Above Pace" : "On Pace";

  const colorClass =
    ratio < 0.95
      ? "bg-red-500"
      : ratio > 1.15
      ? "bg-[var(--pe-orange)]"
      : "bg-green-600";

  // Bar fill capped so it doesn't explode
  const fill = Math.max(0, Math.min(pct, 160)); // cap at 160%
  const fillWidth = `${fill}%`;

  const diff = actual - expected;

  return (
    <div className="rounded-2xl bg-[var(--pe-card)] p-5 shadow-sm border border-black/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold tracking-wide text-black/60">
            Pace Status
          </div>
          <div className="mt-1 text-lg font-extrabold text-[var(--pe-black)]">
            {status}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs font-semibold text-black/50">Actual vs Expected</div>
          <div className="mt-1 text-sm font-extrabold text-[var(--pe-black)]">
            {Math.round(pct)}%
          </div>
        </div>
      </div>

      <div className="mt-3 h-3 w-full rounded-full bg-black/10 overflow-hidden">
        <div className={`h-full ${colorClass}`} style={{ width: fillWidth }} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className="text-black/60">
          Actual: <span className="font-bold text-[var(--pe-black)]">{formatMoney(actual)}</span>
        </div>
        <div className="text-black/60 text-right">
          Expected:{" "}
          <span className="font-bold text-[var(--pe-black)]">{formatMoney(expected)}</span>
        </div>

        <div className="text-black/60">
          Difference:{" "}
          <span className="font-bold text-[var(--pe-black)]">
            {formatMoney(diff)}
          </span>
        </div>
        <div className="text-black/60 text-right">
          Ratio:{" "}
          <span className="font-bold text-[var(--pe-black)]">
            {ratio.toFixed(2)}x
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || "Sales Goal Path";
  const [tab, setTab] = useState<"YTD" | "Monthly" | "Weekly">("YTD");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

async function load() {
  try {
    setLoading(true);
    setError(null);

    // cache-bust querystring so it ALWAYS reloads
    const res = await fetch(`/api/dashboard-data?t=${Date.now()}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      setError("Could not load dashboard data.");
      return;
    }

    setData(await res.json());
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
    load();
  }, []);

    const ytdCards = useMemo(() => {
    if (!data) return [];
    return [
      // swapped order: YTD first, Goal second
      { label: "Sales YTD", value: formatMoney(data.salesYTD) },
      { label: "Sales Goal (Annual)", value: formatMoney(data.salesGoalAnnual) },

      // % of goal on left
      { label: "% of Goal", value: formatPercent(data.percentOfGoal) },

      // replace last year with conversion rate on right
      { label: "Conversion Rate", value: formatPercent(data.conversionRate) },
    ];
  }, [data]);
  
  return (
    <main className="min-h-screen bg-[var(--pe-beige)] p-5">
      <div className="mx-auto max-w-md">
        <div className="rounded-3xl bg-[var(--header-bg)] text-[var(--header-text)] p-5 border border-black/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xl font-extrabold text-[var(--pe-black)]">
                {brandName}
              </div>
              <div className="mt-1 text-sm text-black/60">
                Live dashboard powered by Google Sheet data
              </div>
            </div>

            <button
  onClick={load}
  disabled={loading}
  className={`rounded-full px-4 py-2 text-sm font-bold shadow-sm ${
  loading ? "bg-black/40 text-white" : "bg-[var(--btn-bg)] text-[var(--btn-text)]"
}`}
>
  {loading ? "Refreshing..." : "Refresh"}
</button>
          </div>

          <div className="mt-4 flex gap-2">
            {(["YTD", "Monthly", "Weekly"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  "flex-1 rounded-full px-3 py-2 text-sm font-bold",
                  tab === t
  ? "bg-[var(--tab-active-bg)] text-[var(--tab-active-text)]"
  : "bg-white/80 text-[var(--header-button-text)] border border-black/10",
                ].join(" ")}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* YTD */}
        {tab === "YTD" && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {ytdCards.map((c) => (
                <Card key={c.label} label={c.label} value={c.value} />
              ))}
            </div>

            <div className="mt-4">
              <PaceBar
  actualYTD={data?.ytdActualRevenue ?? null}
  expectedYTD={data?.ytdExpectedRevenue ?? null}
/>
              
            </div>
          </>
        )}

        {/* Monthly */}
        {tab === "Monthly" && (
          <div className="mt-5 space-y-3">
            <MetricRow
              title={`Revenue (${data?.monthly?.month ?? "This Month"})`}
              leftLabel="Actual"
              leftValue={formatMoney(data?.monthly?.revenue?.actual ?? null)}
              rightLabel="Goal"
              rightValue={formatMoney(data?.monthly?.revenue?.target ?? null)}
              status={getStatus(
                data?.monthly?.revenue?.actual ?? null,
                data?.monthly?.revenue?.target ?? null
              )}
              accent="orange"
            />

            <MetricRow
              title={`Quotes Count (${data?.monthly?.month ?? "This Month"})`}
              leftLabel="Actual"
              leftValue={formatInt(data?.monthly?.quotesCount?.actual ?? null)}
              rightLabel="Goal"
              rightValue={formatInt(data?.monthly?.quotesCount?.target ?? null)}
              status={getStatus(
                data?.monthly?.quotesCount?.actual ?? null,
                data?.monthly?.quotesCount?.target ?? null
              )}
              accent="black"
            />

            <MetricRow
              title={`Quotes Value (${data?.monthly?.month ?? "This Month"})`}
              leftLabel="Actual"
              leftValue={formatMoney(data?.monthly?.quotesValue?.actual ?? null)}
              rightLabel="Goal"
              rightValue={formatMoney(data?.monthly?.quotesValue?.target ?? null)}
              status={getStatus(
                data?.monthly?.quotesValue?.actual ?? null,
                data?.monthly?.quotesValue?.target ?? null
              )}
              accent="orange"
            />
          </div>
        )}

        {/* Weekly */}
        {tab === "Weekly" && (
          <div className="mt-5 space-y-3">
            <MetricRow
              title={`Revenue (Week Ending ${data?.weekly?.weekEnding ?? ""})`}
              leftLabel="Actual"
              leftValue={formatMoney(data?.weekly?.revenue?.actual ?? null)}
              rightLabel="Goal"
              rightValue={formatMoney(data?.weekly?.revenue?.target ?? null)}
              status={getStatus(
                data?.weekly?.revenue?.actual ?? null,
                data?.weekly?.revenue?.target ?? null
              )}
              accent="orange"
            />

            <MetricRow
              title={`Quotes Count (Week Ending ${data?.weekly?.weekEnding ?? ""})`}
              leftLabel="Actual"
              leftValue={formatInt(data?.weekly?.quotesCount?.actual ?? null)}
              rightLabel="Goal"
              rightValue={formatInt(data?.weekly?.quotesCount?.target ?? null)}
              status={getStatus(
                data?.weekly?.quotesCount?.actual ?? null,
                data?.weekly?.quotesCount?.target ?? null
              )}
              accent="black"
            />

            <MetricRow
              title={`Quotes Value (Week Ending ${data?.weekly?.weekEnding ?? ""})`}
              leftLabel="Actual"
              leftValue={formatMoney(data?.weekly?.quotesValue?.actual ?? null)}
              rightLabel="Goal"
              rightValue={formatMoney(data?.weekly?.quotesValue?.target ?? null)}
              status={getStatus(
                data?.weekly?.quotesValue?.actual ?? null,
                data?.weekly?.quotesValue?.target ?? null
              )}
              accent="orange"
            />
          </div>
        )}

        <div className="mt-4 text-xs text-black/50 text-center">
          {error ? (
            <span className="text-red-600">{error}</span>
          ) : data?.fetchedAt ? (
            <>Last updated: {new Date(data.fetchedAt).toLocaleString()}</>
          ) : (
            "Loading…"
          )}
        </div>
      </div>
    </main>
  );
}
