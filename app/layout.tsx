import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rot Royale",
  description: "Quick multiplayer arena matches. Find a public match or play with friends.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
