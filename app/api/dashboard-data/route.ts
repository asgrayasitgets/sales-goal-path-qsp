import { NextResponse } from "next/server";

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

  // Monthly table in your sheet is rows 40–51
  for (let row = 40; row <= 51; row++) {
    const first = normalize(getCellRC(grid, row, 1)); // column A
    if (first === target) return row;
  }

  return null;
}

function parseDateLoose(value: string): number | null {
  const s = (value ?? "").toString().trim();
  if (!s) return null;

  const t = Date.parse(s);
  if (!Number.isNaN(t)) return t;

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const mm = parseInt(m[1], 10);
    const dd = parseInt(m[2], 10);
    let yy = parseInt(m[3], 10);
    if (yy < 100) yy += 2000;
    return new Date(yy, mm - 1, dd).getTime();
  }

  return null;
}

function findLatestWeekRow(grid: string[][], today: Date): number | null {
  const todayT = today.getTime();

  let nextRow: number | null = null;
  let nextT = Infinity;

  let prevRow: number | null = null;
  let prevT = -Infinity;

  for (let r = 57; r <= 64; r++) {
    const raw = getCellRC(grid, r, 1); // col A (week ending)
    const t = parseDateLoose(raw);
    if (t == null) continue;

    if (t >= todayT && t < nextT) {
      nextT = t;
      nextRow = r;
    }

    if (t <= todayT && t > prevT) {
      prevT = t;
      prevRow = r;
    }
  }

  // Prefer “current week” (next upcoming week ending). Otherwise fall back.
  return nextRow ?? prevRow;
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

  // Base KPIs (keep these aligned with your sheet)
  const salesGoalAnnual = toNumber(getCellA1(grid, "C3"));
  const lastYearRevenue = toNumber(getCellA1(grid, "C6"));
  const conversionRate = toNumber(getCellA1(grid, "C16"));
  
  // Pace inputs (your plan vs actual ranges)
  const ytdActualRevenue = sumRangeSameColumn(grid, "C57", "C64");
  const ytdExpectedRevenue = sumRangeSameColumn(grid, "B57", "B64");

  // Use these for YTD KPI
  const salesYTD = ytdActualRevenue;
  const percentOfGoal =
    salesGoalAnnual && salesGoalAnnual > 0 ? round2(salesYTD / salesGoalAnnual) : null;

  // ----- Monthly (current month row) -----
  const today = new Date();
  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  const currentMonthName = monthNames[today.getMonth()];
  const monthRow = findMonthRow(grid, currentMonthName);

  // Column mapping (1-based):
  // A=1, B=2, C=3, ... G=7, H=8, I=9, J=10
  // Revenue: target=B, actual=C
  // Quotes COUNT: target=H, actual=J
  // Quotes VALUE: target=G (ASSUMED), actual=I (ASSUMED)
  const monthly =
    monthRow == null
      ? null
      : {
          month: currentMonthName,
          revenue: {
            target: toNumber(getCellRC(grid, monthRow, 2)),
            actual: toNumber(getCellRC(grid, monthRow, 3)),
          },
          quotesCount: {
            target: toNumber(getCellRC(grid, monthRow, 8)),
            actual: toNumber(getCellRC(grid, monthRow, 10)),
          },
          quotesValue: {
            target: toNumber(getCellRC(grid, monthRow, 7)),  // <-- change if needed
            actual: toNumber(getCellRC(grid, monthRow, 9)),   // <-- change if needed
          },
          sourceRow: monthRow,
        };

  // ----- Weekly (latest week row <= today) -----
  const weekRow = findLatestWeekRow(grid, today);

  const weekly =
    weekRow == null
      ? null
      : {
          weekEnding: getCellRC(grid, weekRow, 1),
          revenue: {
            target: toNumber(getCellRC(grid, weekRow, 2)),
            actual: toNumber(getCellRC(grid, weekRow, 3)),
          },
          quotesCount: {
            target: toNumber(getCellRC(grid, weekRow, 8)),
            actual: toNumber(getCellRC(grid, weekRow, 10)),
          },
          quotesValue: {
            target: toNumber(getCellRC(grid, weekRow, 7)),  // <-- change if needed
            actual: toNumber(getCellRC(grid, weekRow, 9)),   // <-- change if needed
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

    mappedCells: {
      salesGoalAnnual: "C3",
      lastYearRevenue: "C6",
      ytdActualRevenue: "C57:C64",
      ytdExpectedRevenue: "B57:B64",
      monthlyRow: "A40:A51 (matched by month name)",
      weeklyRows: "A57+ (latest date <= today)",
      monthlyCols: "Revenue B/C, Quotes Count H/J, Quotes Value G/I (assumed)",
      weeklyCols: "Revenue B/C, Quotes Count H/J, Quotes Value G/I (assumed)",
    },

    fetchedAt: new Date().toISOString(),
  });
}
