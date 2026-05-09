"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [role, setRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState('Freelancer');
  const [isExpert, setIsExpert] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: "📊" },
    { href: "/dashboard/chat", label: "Legal Chatbot", icon: "💬" },
    { href: "/dashboard/voice-chat", label: "Voice Agent", icon: "🎙️" },
    { href: "/dashboard/upload", label: "Upload Contract", icon: "📄" },
    { href: "/dashboard/hil-upload", label: "HIL Upload", icon: "🔄" },
    { href: "/dashboard/ingest", label: "Ingest PDFs", icon: "📥" },
    { href: "/dashboard/vectors", label: "Vectors", icon: "🧭" },
    { href: "/dashboard/resume", label: "Resume Screening", icon: "🧾", rolesOnly: ['HR Professional', 'Recruiter'] },
    { href: "/dashboard/offer-comparison", label: "Offer Comparison", icon: "⚖️", rolesOnly: ['Corporate Employee'] },
    { href: "/dashboard/ai-training", label: "AI Training", icon: "🤖", adminOnly: true },
    { href: "/dashboard/train", label: "Training", icon: "🎯", expertOnly: true },
    { href: "/dashboard/my-reviews", label: "My Reviews", icon: "📝" },
    { href: "/dashboard/admin", label: "Admin Panel", icon: "🔑", adminOnly: true },
    { href: "/dashboard/profile", label: "Profile", icon: "👤" },
    { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
  ];

  const visibleNavItems = navItems.filter(item => {
    if (item.expertOnly) return isExpert;
    if (item.adminOnly) return isAdmin;
    if (item.rolesOnly) return role && item.rolesOnly.includes(role);
    return true;
  });

  useEffect(() => {
    let mounted = true;
    async function fetchRole() {
      if (!session?.user?.email) {
        setRole(null);
        setRoleLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/user/role');
        if (!res.ok) throw new Error('Failed to fetch role');
        const json = await res.json();
        if (mounted) {
          setRole(json.role);
          setIsExpert(json.isExpert || false);
          setIsAdmin(json.isAdmin || false);
          setShowRoleModal(!json.role);
        }


      } catch (err) {
        console.error('Error fetching role', err);
      } finally {
        if (mounted) setRoleLoading(false);
      }
    }
    fetchRole();
    return () => { mounted = false; };
  }, [session]);

  async function saveRole() {
    try {
      const res = await fetch('/api/user/role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: selectedRole }) });
      if (!res.ok) throw new Error('Failed to save role');
      const json = await res.json();
      setRole(json.role);
      setShowRoleModal(false);
      // Redirect to profile to collect role-specific information
      window.location.href = '/dashboard/profile';
    } catch (err) {
      alert('Failed to set role: ' + (err.message || err));
    }
  }

  return (
    <div className="flex min-h-screen bg-black">
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 p-6 h-screen sticky top-0 overflow-hidden flex-shrink-0">
        <h3 className="font-bold text-lg mb-6 text-white">Dashboard</h3>
        <ul className="space-y-1">
          {visibleNavItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${pathname === item.href
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

        {roleLoading ? (
          <div className="text-zinc-400 mt-6">Checking role...</div>
        ) : (
          <div className="text-zinc-400 mt-6">Role: <span className="text-white">{role || 'Not set'}</span></div>
        )}
      </aside>

      <section className="flex-1 p-8 bg-black text-white overflow-auto">{children}</section>

      {/* Role selection modal */}
      {showRoleModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 p-6 rounded max-w-md w-full">
            <h3 className="font-semibold text-lg mb-4">Select your role</h3>
            <p className="text-zinc-400 mb-4">We couldn't find your role in our system. Please select your role so the assistant can tailor advice for you.</p>
            <select className="w-full p-2 bg-zinc-800 text-white rounded mb-4" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
              <option>Freelancer</option>
              <option>Agency</option>
              <option>Corporate Employee</option>
              <option>Employer</option>
              <option>Startup Founder</option>
              <option>HR Professional</option>
              <option>Recruiter</option>
              <option>Expert</option>
            </select>
            <div className="flex gap-3 justify-end">
              <button className="px-3 py-2 bg-zinc-700 rounded" onClick={() => setShowRoleModal(false)}>Cancel</button>
              <button className="px-3 py-2 bg-blue-600 rounded" onClick={saveRole}>Save role</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
