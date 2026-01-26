import "./globals.css";
import Navbar from "@/src/components/navbar";
import { AuthProvider } from "@/context/AuthContext";
import { Toast } from "@/src/components/Toast";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navbar />
          {children}
          <Toast />
        </AuthProvider>
      </body>
    </html>
  );
}
