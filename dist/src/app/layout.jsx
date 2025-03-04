import "./globals.css";
import { RootClient } from "./root-client";
export const metadata = {
    title: "OnmiCenter",
    description: "",
};
export default function RootLayout({ children, }) {
    return (<html lang="en">
      <body>
        <RootClient>
          {children}
        </RootClient>
      </body>
    </html>);
}
//# sourceMappingURL=layout.jsx.map