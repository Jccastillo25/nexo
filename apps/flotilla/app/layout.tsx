import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { getPlatformSettings } from "@/lib/platform-settings";

export async function generateMetadata(): Promise<Metadata> {
  const { productName } = await getPlatformSettings();

  return {
    title: productName,
    description: "Control operativo de viajes para conductores",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: productName,
    },
    icons: {
      icon: ["/icon-192.png", "/icon-512.png"],
      apple: "/apple-touch-icon.png",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
