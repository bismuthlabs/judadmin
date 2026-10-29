import type { Metadata } from "next";
import "./globals.css";
import { RetailProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Everyday Essentials | Retail",
  description: "Retail operations for Everyday Essentials Shop.",
  applicationName: "Everyday Essentials Retail",
  icons: {
    icon: [{ url: "/icons/crud-app-icon-192.jpg", type: "image/jpeg", sizes: "192x192" }],
    apple: [{ url: "/icons/crud-app-icon-192.jpg", type: "image/jpeg", sizes: "192x192" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Everyday Retail",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body><RetailProvider>{children}</RetailProvider></body>
    </html>
  );
}
