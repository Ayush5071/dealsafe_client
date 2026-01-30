import { connectMongoose } from './mongoose';
import User from './models/User';

const uri = process.env.MONGODB_URI;

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
  await User.findOneAndUpdate({ email }, { $set: profileData }, { upsert: true });
  return profileData;
}
