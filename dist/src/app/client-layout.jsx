'use client';
import { Providers } from "./providers";
export function ClientLayout({ children, className, }) {
    return (<Providers className={className}>
      {children}
    </Providers>);
}
//# sourceMappingURL=client-layout.jsx.map