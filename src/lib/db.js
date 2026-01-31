import { connectMongoose } from './mongoose';
import User from './models/User';

const uri = process.env.MONGODB_URI;
const DEFAULT_ADMIN_EMAILS = (process.env.DEFAULT_ADMIN_EMAILS || 'ayusht5071@gmail.com').split(',').map(e => e.trim().toLowerCase());

async function ensureConnection() {
  if (!uri) {
    console.warn('MONGODB_URI not set; mongoose disabled');
    return false;
  }
  const m = await connectMongoose();
  return !!m;
}

export async function getUserRoleByEmail(email) {
  if (!email) return null;
  if (!await ensureConnection()) return null;
  const user = await User.findOne({ email }).select('role').lean();
  return user?.role || null;
}

export async function updateUserRoleByEmail(email, role) {
  if (!email) throw new Error('Email required');
  if (!role) throw new Error('Role required');
  if (!await ensureConnection()) return role;
  await User.findOneAndUpdate({ email }, { $set: { role } }, { upsert: true });
  return role;
}

export async function upsertUserProfile(email, name) {
  if (!email) throw new Error('Email required');
  if (!await ensureConnection()) return null;
  const updated = await User.findOneAndUpdate({ email }, { $set: { email, name } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  return updated;
}

export async function getUserProfile(email) {
  if (!email) return null;
  if (!await ensureConnection()) return null;
  const user = await User.findOne({ email }).lean();
  return user || null;
}

export async function updateUserProfile(email, profileData) {
  if (!email) throw new Error('Email required');
  if (!await ensureConnection()) return profileData;

  // IMPORTANT: Do NOT auto-grant admin or expert privileges here.
  // Admin and expert flags must be explicitly set by an existing admin using the admin endpoints.
  // This prevents privilege escalation when users sign in.
  await User.findOneAndUpdate({ email }, { $set: profileData }, { upsert: true });
  return profileData;
}

export async function ensureAdminSetup(email) {
  if (!email) return;
  const normalized = String(email || '').toLowerCase();
  if (!DEFAULT_ADMIN_EMAILS.includes(normalized) && !DEFAULT_ADMIN_EMAILS.some(e => e && normalized.includes(e))) return;
  if (!await ensureConnection()) return;

  // Ensure the user record exists, but DO NOT auto-grant admin or expert privileges.
  // Admin/expert flags must be explicitly assigned by an existing admin.
  await User.findOneAndUpdate(
    { email: normalized },
    { $setOnInsert: { email: normalized } },
    { upsert: true }
  );
  console.log('Ensured presence of default admin email (no privileges granted):', normalized);
}
