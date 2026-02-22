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
  return (
    <html
  lang="en"
  style={
    {
      "--btn-bg": process.env.NEXT_PUBLIC_BRAND_BUTTON_BG || "#212721",
      "--btn-text": process.env.NEXT_PUBLIC_BRAND_BUTTON_TEXT || "#ffffff",
      "--tab-active-bg": process.env.NEXT_PUBLIC_TAB_ACTIVE_BG || "#212721",
      "--tab-active-text": process.env.NEXT_PUBLIC_TAB_ACTIVE_TEXT || "#ffffff",
      "--tab-inactive-bg": process.env.NEXT_PUBLIC_TAB_INACTIVE_BG,
      "--tab-inactive-text": process.env.NEXT_PUBLIC_TAB_INACTIVE_TEXT,"--brand-card": process.env.NEXT_PUBLIC_BRAND_CARD,
      "--brand-bg": process.env.NEXT_PUBLIC_BRAND_BG,
      "--brand-text": process.env.NEXT_PUBLIC_BRAND_TEXT,
      "--brand-accent": process.env.NEXT_PUBLIC_BRAND_ACCENT,
      "--brand-muted": process.env.NEXT_PUBLIC_BRAND_MUTED,
      "--header-bg": process.env.NEXT_PUBLIC_HEADER_BG,
      "--header-text": process.env.NEXT_PUBLIC_HEADER_TEXT,
      "--header-button-bg": process.env.NEXT_PUBLIC_HEADER_BUTTON_BG,
      "--header-button-text": process.env.NEXT_PUBLIC_HEADER_BUTTON_TEXT,
    } as React.CSSProperties
  }
>
      <body>{children}</body>
    </html>
  );
}
