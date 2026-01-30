import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getUserRoleByEmail, updateUserRoleByEmail } from '@/lib/db';

const ALLOWED_ROLES = [
  'Freelancer',
  'Agency',
  'Corporate Employee',
  'Employer',
  'Startup Founder',
  'HR Professional',
  'Recruiter',
];

export async function GET(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const role = await getUserRoleByEmail(token.email);
    return NextResponse.json({ role: role || null });
  } catch (err) {
    console.error('GET /api/user/role error', err);
    return NextResponse.json({ error: 'Failed to get role' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.email) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json();
    const { role } = body || {};
    if (!role || !ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

    await updateUserRoleByEmail(token.email, role);
    return NextResponse.json({ role });
  } catch (err) {
    console.error('POST /api/user/role error', err);
    return NextResponse.json({ error: 'Failed to set role' }, { status: 500 });
  }
}