import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOOLBX Sales Heatmap",
  description: "Interactive heatmap of TOOLBX sales — customers and prospects",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ background: "#1C1C1E" }}>{children}</body>
    </html>
  );
}
