'use client';

import { Nunito, Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";


const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export function RootClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      {children}
    </Providers>
  );
}
