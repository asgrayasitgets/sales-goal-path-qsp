import { NextResponse } from "next/server";

const BUSINESS_TIMEZONE = "America/Edmonton";

// Dashboard_Data weekly block
const WEEKLY_START_ROW = 57;
const WEEKLY_END_ROW = 109;

// Dashboard_Data monthly block
const MONTHLY_START_ROW = 40;
const MONTHLY_END_ROW = 51;

function datePartsInTimeZone(timeZone: string): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  return { year, month, day };
}

function currentMonthNameInTimeZone(timeZone: string): {
  monthName: string;
  monthNumber: number;
  year: number;
} {
  const { year, month } = datePartsInTimeZone(timeZone);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return {
    monthName: monthNames[month - 1],
    monthNumber: month,
    year,
  };
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

function normalize(s: string) {
  return (s ?? "").toString().trim().toLowerCase();
}

function findMonthRow(grid: string[][], monthName: string): number | null {
  const target = normalize(monthName);

  for (let row = MONTHLY_START_ROW; row <= MONTHLY_END_ROW; row++) {
    const first = normalize(getCellRC(grid, row, 1));

    if (first === target) return row;
  }

  return null;
}

function parseSheetDateToKey(value: string): number | null {
  const s = (value ?? "").toString().trim();
  if (!s) return null;

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);

  if (m) {
    const mm = parseInt(m[1], 10);
    const dd = parseInt(m[2], 10);
    let yy = parseInt(m[3], 10);

    if (yy < 100) yy += 2000;

    return yy * 10000 + mm * 100 + dd;
  }

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

function findCurrentWeekRow(grid: string[][], todayKey: number): number | null {
  let nextRow: number | null = null;
  let nextKey: number | null = null;

  let prevRow: number | null = null;
  let prevKey: number | null = null;

  for (let r = WEEKLY_START_ROW; r <= WEEKLY_END_ROW; r++) {
    const raw = getCellRC(grid, r, 1);
    const key = parseSheetDateToKey(raw);

    if (key == null) continue;

    // Current/in-progress week: first week-ending date greater than or equal to today
    if (key >= todayKey && (nextKey == null || key < nextKey)) {
      nextKey = key;
      nextRow = r;
    }

    // Fallback: latest completed week
    if (key <= todayKey && (prevKey == null || key > prevKey)) {
      prevKey = key;
      prevRow = r;
    }
  }

  return nextRow ?? prevRow;
}

function sumWeeklyRevenueToCurrentWeek(
  grid: string[][],
  currentWeekRow: number | null
): {
  ytdExpectedRevenue: number;
  ytdActualRevenue: number;
} {
  if (currentWeekRow == null) {
    return {
      ytdExpectedRevenue: 0,
      ytdActualRevenue: 0,
    };
  }

  let ytdExpectedRevenue = 0;
  let ytdActualRevenue = 0;

  for (let row = WEEKLY_START_ROW; row <= currentWeekRow; row++) {
    ytdExpectedRevenue += toNumber(getCellRC(grid, row, 2)) ?? 0; // B = weekly target revenue
    ytdActualRevenue += toNumber(getCellRC(grid, row, 3)) ?? 0; // C = weekly actual revenue
  }

  return {
    ytdExpectedRevenue: round2(ytdExpectedRevenue),
    ytdActualRevenue: round2(ytdActualRevenue),
  };
}

export async function GET() {
  const url = process.env.DASHBOARD_CSV_URL;

  if (!url) {
    return NextResponse.json(
      { error: "Missing env var: DASHBOARD_CSV_URL" },
      { status: 500 }
    );
  }

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Failed to fetch CSV (${res.status})` },
      { status: 500 }
    );
  }

  const csvText = await res.text();
  const grid = csvToGrid(csvText);

  const maxCols = Math.max(...grid.map((r) => r.length));
  const gridPadded = grid.map((r) =>
    r.concat(Array(maxCols - r.length).fill(""))
  );

  const salesGoalAnnual = toNumber(getCellA1(grid, "C3"));
  const lastYearRevenue = toNumber(getCellA1(grid, "C6"));
  const conversionRate = toNumber(getCellA1(grid, "C16"));

  const {
    monthName: currentMonthName,
    monthNumber: currentMonthNumber,
    year: currentYear,
  } = currentMonthNameInTimeZone(BUSINESS_TIMEZONE);

  const monthRow = findMonthRow(grid, currentMonthName);

  const todayKey = todayKeyInTimeZone(BUSINESS_TIMEZONE);
  const weekRow = findCurrentWeekRow(grid, todayKey);

  // IMPORTANT:
  // Pace Status YTD now comes from weekly rows 57–109.
  // It sums weekly target revenue and weekly actual revenue up to the current week.
  const { ytdExpectedRevenue, ytdActualRevenue } =
    sumWeeklyRevenueToCurrentWeek(grid, weekRow);

  const salesYTD = ytdActualRevenue;

  const percentOfGoal =
    salesGoalAnnual && salesGoalAnnual > 0
      ? round2(salesYTD / salesGoalAnnual)
      : null;

  const monthly =
    monthRow == null
      ? null
      : {
          month: currentMonthName,
          monthNumber: currentMonthNumber,
          year: currentYear,

          revenue: {
            target: toNumber(getCellRC(grid, monthRow, 2)), // B
            actual: toNumber(getCellRC(grid, monthRow, 3)), // C
          },

          quotesCount: {
            target: toNumber(getCellRC(grid, monthRow, 8)), // H
            actual: toNumber(getCellRC(grid, monthRow, 10)), // J
          },

          quotesValue: {
            target: toNumber(getCellRC(grid, monthRow, 7)), // G
            actual: toNumber(getCellRC(grid, monthRow, 9)), // I
          },

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
            target: toNumber(getCellRC(grid, weekRow, 7)), // G
            actual: toNumber(getCellRC(grid, weekRow, 9)), // I
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

      ytdFromWeeklyRows: {
        startRow: WEEKLY_START_ROW,
        endRow: weekRow,
        expectedRevenueColumn: "B",
        actualRevenueColumn: "C",
        ytdExpectedRevenue,
        ytdActualRevenue,
      },

      monthRow,
      monthRowLen: monthRow ? grid[monthRow - 1]?.length ?? null : null,

      jobsMonthlyRaw:
        monthRow == null
          ? null
          : {
              K: getCellRC(grid, monthRow, 11),
              L: getCellRC(grid, monthRow, 12),
              M: getCellRC(grid, monthRow, 13),
              N: getCellRC(grid, monthRow, 14),
            },

      weekRowLen: weekRow ? grid[weekRow - 1]?.length ?? null : null,

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
