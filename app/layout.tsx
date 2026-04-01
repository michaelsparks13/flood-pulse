import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FloodPulse — Global Flood Exposure Clock",
  description:
    "How many people have been exposed to flooding since 2000? An interactive globe built on Google's Groundsource dataset of 2.6M flood events.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
