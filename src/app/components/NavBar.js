"use client";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function NavBar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const [isExpert, setIsExpert] = useState(false);

  useEffect(() => {
    async function checkExpertStatus() {
      if (session?.user?.email) {
        try {
          const response = await fetch('/api/user/profile');
          if (response.ok) {
            const data = await response.json();
            const profile = data.profile || {};
            setIsExpert(profile?.expert || profile?.isExpert || false);
          }
        } catch (error) {
          console.error('Failed to check expert status:', error);
        }
      }
    }

    checkExpertStatus();
  }, [session?.user?.email]);

  return (
    <nav className="w-full bg-black/95 backdrop-blur-sm border-b border-zinc-800 text-white px-6 py-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            DealSafe
          </Link>
          {!isLanding && session && (
            <>
              <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors">
                Dashboard
              </Link>
              {isExpert && (
                <Link href="/dashboard/train" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                  Training
                </Link>
              )}
            </>
          )}
        </div>
        <div>
          {!session ? (
            <button 
              onClick={() => signIn("google", { callbackUrl: '/dashboard' })} 
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-all"
            >
              Sign in with Google
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <Link href="/dashboard/profile" className="text-sm text-zinc-400 hover:text-white transition-colors">
                {session.user?.email}
              </Link>
              <button 
                onClick={() => signOut()} 
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}