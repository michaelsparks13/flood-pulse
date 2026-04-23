import type { Metadata } from "next";
import "./globals.css";
import { GlobeProvider } from "@/context/GlobeContext";

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
      <head>
        <link
          rel="preload"
          as="fetch"
          href="/data/hex_compact.json"
          type="application/json"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="fetch"
          href="/data/gfd_observed_countries.json"
          type="application/json"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <GlobeProvider>{children}</GlobeProvider>
      </body>
    </html>
  );
}
