
import "./globals.css";

export const metadata = {
  title: "Sales Goal Path",
  description: "Live dashboard powered by Google Sheet data",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const styleVars = {
    // =========================
    // Brand tokens (new standard)
    // =========================
    ["--brand-bg" as any]: process.env.NEXT_PUBLIC_BRAND_BG || "#F1EFE7",

    ["--brand-surface" as any]:
      process.env.NEXT_PUBLIC_BRAND_SURFACE ||
      process.env.NEXT_PUBLIC_BRAND_CARD || // backward compat
      "rgba(255,255,255,0.65)",

    ["--brand-surface-strong" as any]:
      process.env.NEXT_PUBLIC_BRAND_SURFACE_STRONG || "#212721",

    ["--brand-text" as any]: process.env.NEXT_PUBLIC_BRAND_TEXT || "#212721",

    ["--brand-text-muted" as any]:
      process.env.NEXT_PUBLIC_BRAND_TEXT_MUTED || "rgba(33,39,33,0.70)",

    ["--brand-border" as any]:
      process.env.NEXT_PUBLIC_BRAND_BORDER || "rgba(33,39,33,0.14)",

    ["--brand-accent" as any]:
      process.env.NEXT_PUBLIC_BRAND_ACCENT || "#CAB448",

    ["--brand-accent-contrast" as any]:
      process.env.NEXT_PUBLIC_BRAND_ACCENT_CONTRAST || "#ffffff",

    ["--brand-success" as any]:
      process.env.NEXT_PUBLIC_BRAND_SUCCESS || "#16a34a",

    ["--brand-warning" as any]:
      process.env.NEXT_PUBLIC_BRAND_WARNING || "#f59e0b",

    ["--brand-danger" as any]:
      process.env.NEXT_PUBLIC_BRAND_DANGER || "#ef4444",

    // =========================
    // Backward compatibility
    // (so older globals or components still work)
    // =========================
    ["--brand-card" as any]:
      process.env.NEXT_PUBLIC_BRAND_CARD ||
      process.env.NEXT_PUBLIC_BRAND_SURFACE ||
      "rgba(255,255,255,0.65)",

    ["--brand-muted" as any]:
      process.env.NEXT_PUBLIC_BRAND_MUTED ||
      process.env.NEXT_PUBLIC_BRAND_TEXT_MUTED ||
      "rgba(33,39,33,0.70)",

    // =========================
    // Buttons / Tabs
    // =========================
    ["--btn-bg" as any]:
      process.env.NEXT_PUBLIC_BRAND_BUTTON_BG ||
      process.env.NEXT_PUBLIC_BRAND_SURFACE_STRONG ||
      "#212721",

    ["--btn-text" as any]:
      process.env.NEXT_PUBLIC_BRAND_BUTTON_TEXT || "#ffffff",

    ["--tab-active-bg" as any]:
      process.env.NEXT_PUBLIC_TAB_ACTIVE_BG ||
      process.env.NEXT_PUBLIC_BRAND_SURFACE_STRONG ||
      "#212721",

    ["--tab-active-text" as any]:
      process.env.NEXT_PUBLIC_TAB_ACTIVE_TEXT || "#ffffff",

    ["--tab-inactive-bg" as any]:
      process.env.NEXT_PUBLIC_TAB_INACTIVE_BG ||
      process.env.NEXT_PUBLIC_BRAND_SURFACE ||
      "rgba(255,255,255,0.65)",

    ["--tab-inactive-text" as any]:
      process.env.NEXT_PUBLIC_TAB_INACTIVE_TEXT ||
      process.env.NEXT_PUBLIC_BRAND_TEXT ||
      "#212721",

    // =========================
    // Header (optional)
    // =========================
    ["--header-bg" as any]:
      process.env.NEXT_PUBLIC_HEADER_BG ||
      process.env.NEXT_PUBLIC_BRAND_SURFACE_STRONG ||
      "#212721",

    ["--header-text" as any]:
      process.env.NEXT_PUBLIC_HEADER_TEXT || "#ffffff",

    ["--header-button-bg" as any]:
      process.env.NEXT_PUBLIC_HEADER_BUTTON_BG ||
      process.env.NEXT_PUBLIC_BRAND_ACCENT ||
      "#CAB448",

    ["--header-button-text" as any]:
      process.env.NEXT_PUBLIC_HEADER_BUTTON_TEXT ||
      process.env.NEXT_PUBLIC_BRAND_ACCENT_CONTRAST ||
      "#ffffff",
  } as React.CSSProperties;

  return (
    <html lang="en" style={styleVars}>
      <body>{children}</body>
    </html>
  );
}
