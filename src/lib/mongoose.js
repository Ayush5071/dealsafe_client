import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;

export async function connectMongoose() {
  if (!uri) {
    console.warn('MONGODB_URI not set; mongoose will be disabled');
    return null;
  }

  if (mongoose.connection.readyState === 1) return mongoose;

  try {
    await mongoose.connect(uri, {
      // recommended options
      // use new URL parser and unified topology are defaults in modern mongoose
      autoIndex: true,
    });
    console.log('Connected to MongoDB via Mongoose');
    return mongoose;
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    return null;
  }
}
