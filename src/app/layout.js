import "./globals.css";
import AuthGuard from "@/components/AuthGuard";

export const metadata = {
  title: "托管签到系统",
  description: "用于老师统计每日的托管情况",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <body>
        <div className="app-container">
          <AuthGuard>{children}</AuthGuard>
        </div>
      </body>
    </html>
  );
}
