import type { Metadata } from "next";
import "./globals.css";
import { RetailProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Everyday Essentials | Retail",
  description: "Retail operations for Everyday Essentials Shop.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body><RetailProvider>{children}</RetailProvider></body>
    </html>
  );
}
