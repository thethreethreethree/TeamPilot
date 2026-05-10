import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExecOS — AI Executive Operating System",
  description: "AI-powered executive intelligence for modern businesses",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0c0d16] text-[#e8eaf6] antialiased">
        {children}
      </body>
    </html>
  );
}
