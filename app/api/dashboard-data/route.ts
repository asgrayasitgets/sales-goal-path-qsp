import { NextResponse } from "next/server";

const BUSINESS_TIMEZONE = "America/Edmonton";

// Adjust if your weekly block moves
const WEEKLY_START_ROW = 57;
const WEEKLY_END_ROW = 109;

function datePartsInTimeZone(timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value); // 1..12
  const day = Number(parts.find((p) => p.type === "day")?.value);

  return { year, month, day };
}

function currentMonthNameInTimeZone(timeZone: string): { monthName: string; monthNumber: number; year: number } {
  const { year, month } = datePartsInTimeZone(timeZone);
  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  return { monthName: monthNames[month - 1], monthNumber: month, year };
}

function csvToGrid(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    cur += ch;
  }

  row.push(cur);
  rows.push(row);

  return rows;
}

function getCellRC(grid: string[][], row: number, col: number): string {
  return (grid[row - 1]?.[col - 1] ?? "").toString().trim();
}

function getCellA1(grid: string[][], a1: string): string {
  const match = a1.match(/^([A-Z]+)(\d+)$/);
  if (!match) return "";

  const colLetters = match[1];
  const rowNumber = parseInt(match[2], 10);

  let colNumber = 0;
  for (let i = 0; i < colLetters.length; i++) {
    colNumber = colNumber * 26 + (colLetters.charCodeAt(i) - 64);
  }

  return getCellRC(grid, rowNumber, colNumber);
}

function toNumber(value: string): number | null {
  const cleaned = (value ?? "")
    .toString()
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sumRangeSameColumn(grid: string[][], startCell: string, endCell: string): number {
  const start = startCell.match(/^([A-Z]+)(\d+)$/);
  const end = endCell.match(/^([A-Z]+)(\d+)$/);
  if (!start || !end) return 0;

  const colLetters = start[1];
  const startRow = parseInt(start[2], 10);
  const endRow = parseInt(end[2], 10);

  let total = 0;
  for (let r = startRow; r <= endRow; r++) {
    total += toNumber(getCellA1(grid, `${colLetters}${r}`)) ?? 0;
  }
  return round2(total);
}

function normalize(s: string) {
  return (s ?? "").toString().trim().toLowerCase();
}

function findMonthRow(grid: string[][], monthName: string): number | null {
  const target = normalize(monthName);

  // Monthly table rows 40–51
  for (let row = 40; row <= 51; row++) {
    const first = normalize(getCellRC(grid, row, 1)); // A
    if (first === target) return row;
  }
  return null;
}

/**
 * Convert a date in the sheet to a YYYYMMDD integer key (date-only).
 * Handles:
 * - MM/DD/YYYY
 * - M/D/YYYY
 * - plus a fallback Date.parse if Google exports something else
 */
function parseSheetDateToKey(value: string): number | null {
  const s = (value ?? "").toString().trim();
  if (!s) return null;

  // Prefer explicit M/D/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const mm = parseInt(m[1], 10);
    const dd = parseInt(m[2], 10);
    let yy = parseInt(m[3], 10);
    if (yy < 100) yy += 2000;
    return yy * 10000 + mm * 100 + dd;
  }

  // Fallback: try Date.parse, then extract UTC components (date-only-ish)
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const yy = d.getUTCFullYear();
    const mm = d.getUTCMonth() + 1;
    const dd = d.getUTCDate();
    return yy * 10000 + mm * 100 + dd;
  }

  return null;
}

/**
 * Get today's YYYYMMDD key in BUSINESS_TIMEZONE (prevents UTC/server timezone issues).
 */
function todayKeyInTimeZone(timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);

  return y * 10000 + m * 100 + d;
}

/**
 * Pick the "current week" row given that Week Ending is a Sunday.
 * Rule:
 * - choose the first week-ending date >= today (this is the in-progress week)
 * - fallback to latest <= today
 */
function findCurrentWeekRow(grid: string[][], todayKey: number): number | null {
  let nextRow: number | null = null;
  let nextKey: number | null = null;

  let prevRow: number | null = null;
  let prevKey: number | null = null;

  for (let r = WEEKLY_START_ROW; r <= WEEKLY_END_ROW; r++) {
    const raw = getCellRC(grid, r, 1); // col A: Week Ending on
    const k = parseSheetDateToKey(raw);
    if (k == null) continue;

    if (k >= todayKey && (nextKey == null || k < nextKey)) {
      nextKey = k;
      nextRow = r;
    }

    if (k <= todayKey && (prevKey == null || k > prevKey)) {
      prevKey = k;
      prevRow = r;
    }
  }

  return nextRow ?? prevRow;
}

export async function GET() {
  const url = process.env.DASHBOARD_CSV_URL;
  if (!url) {
    return NextResponse.json({ error: "Missing env var: DASHBOARD_CSV_URL" }, { status: 500 });
  }

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: `Failed to fetch CSV (${res.status})` }, { status: 500 });
  }

  const csvText = await res.text();
  const grid = csvToGrid(csvText);
  const maxCols = Math.max(...grid.map((r) => r.length));
  const gridPadded = grid.map((r) => r.concat(Array(maxCols - r.length).fill("")));
  // Base KPIs
  const salesGoalAnnual = toNumber(getCellA1(grid, "C3"));
  const lastYearRevenue = toNumber(getCellA1(grid, "C6"));
  const conversionRate = toNumber(getCellA1(grid, "C16"));

  
  // YTD from monthly table rows 40-51, including current month
  const {
    monthName: currentMonthName,
    monthNumber: currentMonthNumber,
    year: currentYear,
  } = currentMonthNameInTimeZone(BUSINESS_TIMEZONE);

  const currentMonthRow = findMonthRow(grid, currentMonthName);

  let ytdActualRevenue = 0;
  let ytdExpectedRevenue = 0;

  if (currentMonthRow != null) {
    for (let row = 40; row <= currentMonthRow; row++) {
      ytdExpectedRevenue += toNumber(getCellRC(grid, row, 2)) ?? 0; // B = target revenue
      ytdActualRevenue += toNumber(getCellRC(grid, row, 3)) ?? 0;   // C = actual revenue
    }

    ytdActualRevenue = round2(ytdActualRevenue);
    ytdExpectedRevenue = round2(ytdExpectedRevenue);
  }

  const salesYTD = ytdActualRevenue;

  const percentOfGoal =
    salesGoalAnnual && salesGoalAnnual > 0 ? round2(salesYTD / salesGoalAnnual) : null;

  // ----- Monthly -----
  const today = new Date();
  // ----- Monthly (current month in BUSINESS_TIMEZONE) -----
const monthRow = findMonthRow(grid, currentMonthName);


// Column mapping (1-based):
// Revenue: target=B, actual=C
// Quotes COUNT: target=H, actual=J
// Quotes VALUE: target=G (ASSUMED), actual=I (ASSUMED)
const monthly =
  monthRow == null
    ? null
    : {
        month: currentMonthName,
        monthNumber: currentMonthNumber,
        year: currentYear,
        revenue: {
          target: toNumber(getCellRC(grid, monthRow, 2)),
          actual: toNumber(getCellRC(grid, monthRow, 3)),
        },
        quotesCount: {
          target: toNumber(getCellRC(grid, monthRow, 8)),
          actual: toNumber(getCellRC(grid, monthRow, 10)),
        },
        quotesValue: {
          target: toNumber(getCellRC(grid, monthRow, 7)),
          actual: toNumber(getCellRC(grid, monthRow, 9)),
        },

        // ✅ Jobs Landed
        jobsLandedValue: {
  target: toNumber(getCellRC(gridPadded, monthRow, 11)), // K
  actual: toNumber(getCellRC(gridPadded, monthRow, 13)), // M
},
jobsLandedCount: {
  target: toNumber(getCellRC(gridPadded, monthRow, 12)), // L
  actual: toNumber(getCellRC(gridPadded, monthRow, 14)), // N
},

        sourceRow: monthRow,
      };
  
  // ----- Weekly (CURRENT WEEK) -----
  const todayKey = todayKeyInTimeZone(BUSINESS_TIMEZONE);
  const weekRow = findCurrentWeekRow(grid, todayKey);

 const weekly =
  weekRow == null
    ? null
    : {
        weekEnding: getCellRC(grid, weekRow, 1),
        revenue: {
          target: toNumber(getCellRC(grid, weekRow, 2)), // B
          actual: toNumber(getCellRC(grid, weekRow, 3)), // C
        },
        quotesCount: {
          target: toNumber(getCellRC(grid, weekRow, 8)), // H
          actual: toNumber(getCellRC(grid, weekRow, 10)), // J
        },
        quotesValue: {
          target: toNumber(getCellRC(grid, weekRow, 7)), // G (assumed)
          actual: toNumber(getCellRC(grid, weekRow, 9)), // I (assumed)
        },

       jobsLandedValue: {
  target: toNumber(getCellRC(gridPadded, weekRow, 11)), // K
  actual: toNumber(getCellRC(gridPadded, weekRow, 13)), // M
},
jobsLandedCount: {
  target: toNumber(getCellRC(gridPadded, weekRow, 12)), // L
  actual: toNumber(getCellRC(gridPadded, weekRow, 14)), // N
},

        sourceRow: weekRow,
      };
  
  return NextResponse.json({
    salesGoalAnnual,
    salesYTD,
    lastYearRevenue,
    percentOfGoal,

    conversionRate,

    ytdActualRevenue,
    ytdExpectedRevenue,

    monthly,
    weekly,

    debug: {
  businessTimeZone: BUSINESS_TIMEZONE,
  todayKey,
  weeklyRange: `${WEEKLY_START_ROW}-${WEEKLY_END_ROW}`,
  pickedWeeklyRow: weekRow,
  pickedWeekEnding: weekRow ? getCellRC(grid, weekRow, 1) : null,

  // ===== Jobs Landed debug =====
  monthRow,
  monthRowLen: monthRow ? (grid[monthRow - 1]?.length ?? null) : null,
  jobsMonthlyRaw:
    monthRow == null
      ? null
      : {
          K: getCellRC(grid, monthRow, 11),
          L: getCellRC(grid, monthRow, 12),
          M: getCellRC(grid, monthRow, 13),
          N: getCellRC(grid, monthRow, 14),
        },

  weekRowLen: weekRow ? (grid[weekRow - 1]?.length ?? null) : null,
  jobsWeeklyRaw:
    weekRow == null
      ? null
      : {
          K: getCellRC(grid, weekRow, 11),
          L: getCellRC(grid, weekRow, 12),
          M: getCellRC(grid, weekRow, 13),
          N: getCellRC(grid, weekRow, 14),
        },
},

    fetchedAt: new Date().toISOString(),
  });
}
