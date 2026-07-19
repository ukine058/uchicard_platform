import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "カードゲームプラットフォーム",
  description: "リアルタイム同期対応のカードゲーム盤面",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
