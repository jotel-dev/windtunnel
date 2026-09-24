import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "WindTunnel | Stress-Test Your Meteora DBC Token Launch",
  description: "Interactive simulation and economic stress-test engine for Meteora Dynamic Bonding Curves. Protect organic buyers, calculate sniper extraction, and verify DAMM v2 migration.",
  keywords: ["Meteora", "DBC", "Solana", "Dynamic Bonding Curve", "DAMM v2", "Crypto Simulation", "Jito MEV"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} scroll-smooth`}>
      <body className="min-h-screen flex flex-col bg-[#F7F3EC] text-[#171717]">
        {children}
      </body>
    </html>
  );
}
