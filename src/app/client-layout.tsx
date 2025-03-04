'use client';

import { Providers } from "./providers";

export function ClientLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <Providers className={className}>
      {children}
    </Providers>
  );
}
