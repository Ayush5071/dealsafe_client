"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  
  const navItems = [
    { href: "/dashboard", label: "Overview", icon: "📊" },
    { href: "/dashboard/chat", label: "Legal Chatbot", icon: "💬" },
    { href: "/dashboard/upload", label: "Upload Contract", icon: "📄" },
    { href: "/dashboard/profile", label: "Profile", icon: "👤" },
    { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div className="flex min-h-screen bg-black">
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 p-6">
        <h3 className="font-bold text-lg mb-6 text-white">Dashboard</h3>
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  pathname === item.href
                    ? "bg-blue-600 text-white"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <section className="flex-1 p-8 bg-black text-white overflow-auto">{children}</section>
    </div>
  );
}
