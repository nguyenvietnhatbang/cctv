import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { brandAssets, companyProfile } from "@/lib/company";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(`https://${companyProfile.website}`),
  title: {
    default: `${companyProfile.appName} | Điều phối kỹ thuật CCTV`,
    template: `%s | ${companyProfile.displayName}`,
  },
  description: `${companyProfile.legalName} - hệ thống điều phối kỹ thuật, khách hàng, thanh toán và bảo trì CCTV.`,
  applicationName: companyProfile.appName,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: companyProfile.appName,
    statusBarStyle: "default",
  },
  authors: [{ name: companyProfile.legalName, url: `https://${companyProfile.website}` }],
  icons: {
    icon: brandAssets.favicon,
    shortcut: brandAssets.favicon,
    apple: brandAssets.mark,
  },
  openGraph: {
    title: companyProfile.appName,
    description: `${companyProfile.businessLine}. Hotline tư vấn ${companyProfile.consultationPhone}.`,
    siteName: companyProfile.displayName,
    locale: "vi_VN",
    type: "website",
    images: [
      {
        url: brandAssets.horizontalLogo,
        width: 3290,
        height: 1423,
        alt: companyProfile.legalName,
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
