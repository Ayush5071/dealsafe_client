import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { upsertUserProfile, getUserRoleByEmail } from '@/lib/db';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    // Persist user profile and attach role to JWT token
    async jwt({ token, user }) {
      try {
        if (user?.email) {
          await upsertUserProfile(user.email, user.name);
          const role = await getUserRoleByEmail(user.email);
          token.role = role || null;
        }
      } catch (err) {
        console.error('JWT callback DB error', err);
      }
      return token;
    },

    // Make role available on session.user.role
    async session({ session, token }) {
      session.user = session.user || {};
      session.user.role = token?.role || null;
      return session;
    },

    // Ensure post-login redirect goes to dashboard by default
    async redirect({ url, baseUrl }) {
      // If a relative path is provided, respect it
      if (url && url.startsWith('/')) return `${baseUrl}${url}`;
      // If the callback comes from provider sign-in, send to dashboard
      if (url && url.includes('/api/auth/callback')) return `${baseUrl}/dashboard`;
      // Otherwise default to dashboard
      return `${baseUrl}/dashboard`;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
