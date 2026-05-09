import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getUserProfile } from '@/lib/db';
import { redirect } from 'next/navigation';

export default async function TrainLayout({ children }) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    redirect('/api/auth/signin');
  }

  // Check if user is an expert
  let userProfile;
  try {
    userProfile = await getUserProfile(session.user.email);
  } catch (error) {
    console.error('Failed to get user profile:', error);
    redirect('/dashboard');
  }

  if (!userProfile?.expert && !userProfile?.isExpert) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold">Training Mode</h1>
              <span className="px-2 py-1 bg-purple-600 text-xs font-medium rounded">EXPERT ONLY</span>
            </div>
            <div className="text-sm text-zinc-400">
              Logged in as: <span className="text-zinc-200">{session.user.email}</span>
            </div>
          </div>
          <p className="text-zinc-400 mt-2">
            Advanced training interface for improving AI contract analysis models
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

export const metadata = {
  title: 'AI Training - DealSafe',
  description: 'Expert-only training interface for contract analysis models',
};