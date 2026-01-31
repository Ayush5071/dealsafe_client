import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectMongoose } from '@/lib/mongoose';
import User from '@/lib/models/User';

export async function POST(req) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const email = String(session.user.email).toLowerCase();

    // Check if email is allowed via env
    const DEFAULT_ADMIN_EMAILS = (process.env.DEFAULT_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

    // Only allow self-promotion when the email is explicitly listed in DEFAULT_ADMIN_EMAILS
    if (!DEFAULT_ADMIN_EMAILS.includes(email)) {
      console.warn('Promote-me attempt blocked for', email, 'allowed:', DEFAULT_ADMIN_EMAILS);
      return NextResponse.json({ error: 'Email not authorized to self-promote' }, { status: 403 });
    }

    await connectMongoose();

    const user = await User.findOneAndUpdate(
      { email },
      { $set: { isAdmin: true, isExpert: true, expert: true, role: 'Expert' } },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, user });
  } catch (err) {
    console.error('Promote-me error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}