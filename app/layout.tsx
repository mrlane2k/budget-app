import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BudgetApp - Personal Finance",
  description: "Local personal budgeting and bill tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">{children}</body>
    </html>
  );
}
