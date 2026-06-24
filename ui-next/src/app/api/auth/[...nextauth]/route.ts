import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  // 🏢 Link adapter for natively tracking profiles data rows
  adapter: PrismaAdapter(prisma),

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing mandatory credentials fields.");
        }
        const targetEmail = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email: targetEmail } });
        if (!user || !user.password) {
          throw new Error("Identity node record not registered.");
        }
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
        if (!isPasswordValid) {
          throw new Error("Invalid password signature.");
        }
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      }
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),


    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID || "common",

      // ⚡ COMPREHENSIVE ISSUER HANDSHAKE SYNCHRONIZATION 
      authorization: {
        params: {
          scope: "openid profile email User.Read",
          prompt: "select_account", // Enforces explicit selection panel
        },
      },
      client: {
        token_endpoint_auth_method: "client_secret_post",
      },
      // 🚨 CRUCIAL FILTER OVERRIDE: Tells NextAuth to allow dynamic multi-tenant issuer IDs safely
      allowDangerousEmailAccountLinking: true,

      profile(profile) {
        return {
          id: profile.sub || profile.oid,
          name: profile.name || profile.preferred_username || "Microsoft Operator",
          email: profile.email || profile.preferred_username || profile.upn,
          image: null,
          role: "user", // System default assignment node
        };
      },
    }),

    {
      id: "linkedin",
      name: "LinkedIn",
      type: "oauth",
      wellKnown: "https://www.linkedin.com/oauth/.well-known/openid-configuration",
      authorization: { params: { scope: "openid profile email" } },
      client: { token_endpoint_auth_method: "client_secret_post" },
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      idToken: true,
      checks: ["state"],
      profile(profile) {
        return { id: profile.sub, name: profile.name, email: profile.email, image: profile.picture, role: "user" };
      },
    },
  ],

  session: {
    strategy: "jwt", // ⚡ Keeps dynamic token mapping fast and responsive without session block lockups
    maxAge: 30 * 24 * 60 * 60
  },

  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: "/",
    error: "/",
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") {
        return true;
      }

      if (user.email) {
        const targetEmail = user.email.toLowerCase().trim();
        const existingUser = await prisma.user.findUnique({
          where: { email: targetEmail }
        });

        // 🚨 TESTING BYPASS: If social user doesn't exist, automatically insert them safely!
        if (!existingUser) {
          await prisma.user.create({
            data: {
              email: targetEmail,
              name: user.name || "OAuth Operator",
              role: "user"
            }
          });
        }
        return true;
      }
      return false;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "user";
      }
      if (account) {
        token.accessToken = account.access_token;
      }
      if (token.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email } });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).id = token.id || token.sub;
        (session.user as any).role = token.role || "user";
      }
      return session;
    }
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };