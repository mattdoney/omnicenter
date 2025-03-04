import type { Metadata } from "next";
import "./globals.css";
import { RootClient } from "./root-client";

export const metadata: Metadata = {
  title: "OnmiCenter",
  description: "",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <RootClient>
          {children}
        </RootClient>
      </body>
    </html>
  );
}
