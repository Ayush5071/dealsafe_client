import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getUserProfile, updateUserProfile } from '@/lib/db';

export async function GET(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const profile = await getUserProfile(token.email);
    return NextResponse.json({ profile: profile || {} });
  } catch (err) {
    console.error('GET /api/user/profile error', err);
    return NextResponse.json({ error: 'Failed to get profile' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json();
    await updateUserProfile(token.email, body);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/user/profile error', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}