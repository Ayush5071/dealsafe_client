import "./globals.css";
import NavBar from "./components/NavBar";
import AuthProvider from "./AuthProvider";


export const metadata = {
  title: "DealSafe - AI Contract Analysis",
  description: "Protect your business with AI-powered contract analysis for Indian law",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`antialiased`}
      >
        <AuthProvider>
          <NavBar />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
