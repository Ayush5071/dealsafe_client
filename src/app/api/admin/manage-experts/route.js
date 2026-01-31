import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectMongoose } from '@/lib/mongoose';
import User from '@/lib/models/User';

const ADMIN_EMAIL = 'ayusht5071@gmail.com';

export async function POST(req) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();

    // Check if requester is admin
    const adminUser = await User.findOne({ email: session.user.email });
    if (!adminUser || !adminUser.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const { email, action } = await req.json();
    if (!email || !action) {
      return NextResponse.json({ error: 'Email and action required' }, { status: 400 });
    }

    const targetUser = await User.findOne({ email });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (action === 'promote_expert') {
      targetUser.isExpert = true;
      targetUser.expert = true;
      if (!targetUser.role || targetUser.role === 'Expert') {
        targetUser.role = 'Expert';
      }
      await targetUser.save();
      return NextResponse.json({ 
        success: true, 
        message: `${email} promoted to Expert`,
        user: targetUser 
      });
    } else if (action === 'revoke_expert') {
      targetUser.isExpert = false;
      targetUser.expert = false;
      await targetUser.save();
      return NextResponse.json({ 
        success: true, 
        message: `Expert privileges revoked for ${email}`,
        user: targetUser 
      });
    } else if (action === 'promote_admin') {
      // Make admin and mark as expert by default
      targetUser.isAdmin = true;
      targetUser.isExpert = true;
      targetUser.expert = true;
      if (!targetUser.role || targetUser.role === 'Expert') {
        targetUser.role = 'Admin';
      }
      await targetUser.save();
      return NextResponse.json({ success: true, message: `${email} promoted to Admin (and Expert)`, user: targetUser });
    } else if (action === 'revoke_admin') {
      // Revoke admin but keep expert flag unchanged (admins are experts by default; revoking admin does not automatically remove expert)
      targetUser.isAdmin = false;
      await targetUser.save();
      return NextResponse.json({ success: true, message: `Admin privileges revoked for ${email}`, user: targetUser });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Admin action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectMongoose();

    const adminUser = await User.findOne({ email: session.user.email });
    if (!adminUser || !adminUser.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    // Get all users with their expert status
    const users = await User.find({}, { 
      email: 1, 
      name: 1, 
      role: 1, 
      isExpert: 1, 
      expert: 1,
      isAdmin: 1,
      createdAt: 1 
    }).sort({ createdAt: -1 });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
