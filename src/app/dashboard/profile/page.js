"use client";
import { useSession } from "next-auth/react";

export default function ProfilePage() {
  const { data: session } = useSession();

  if (!session) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-400">Please sign in to view your profile</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Profile</h2>
        <p className="text-zinc-400">Manage your account information</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl space-y-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-3xl font-bold">
            {session.user?.name?.[0] || session.user?.email?.[0] || "U"}
          </div>
          <div>
            <h3 className="text-xl font-semibold">{session.user?.name || "User"}</h3>
            <p className="text-zinc-400">{session.user?.email}</p>
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-6 space-y-4">
          <div>
            <label className="text-sm text-zinc-400">Full Name</label>
            <div className="mt-1 text-white">{session.user?.name || "Not provided"}</div>
          </div>
          <div>
            <label className="text-sm text-zinc-400">Email</label>
            <div className="mt-1 text-white">{session.user?.email}</div>
          </div>
          <div>
            <label className="text-sm text-zinc-400">Account Type</label>
            <div className="mt-1 text-white">Free Plan</div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl">
        <h3 className="text-lg font-semibold mb-4">Account Statistics</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <div className="text-2xl font-bold">0</div>
            <div className="text-sm text-zinc-400">Contracts Analyzed</div>
          </div>
          <div>
            <div className="text-2xl font-bold">0</div>
            <div className="text-sm text-zinc-400">Queries Made</div>
          </div>
          <div>
            <div className="text-2xl font-bold">0</div>
            <div className="text-sm text-zinc-400">Days Active</div>
          </div>
        </div>
      </div>
    </div>
  );
}
