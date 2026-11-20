import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Adinn Signage CRM",
  description: "Digitize. Track. Approve. Execute.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions (e.g. QuillBot: data-qb-installed) add attributes to <html> before React loads; this ignores
    // only those attribute differences on this one tag (children are still checked).
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
