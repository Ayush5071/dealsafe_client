import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getUserRoleByEmail } from '@/lib/db';

export async function GET(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const role = await getUserRoleByEmail(token.email);
    return NextResponse.json({ email: token.email, name: token.name || null, role: role || null });
  } catch (err) {
    console.error('GET /api/user/me error', err);
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
  }
}