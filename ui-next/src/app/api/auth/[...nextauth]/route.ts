import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  // 🏢 LINK PRISMA ADAPTER TO PERSIST SOCIAL & CREDENTIALS SESSIONS NATIVELY
  adapter: PrismaAdapter(prisma),

  providers: [
    // 1. 🛡️ NEW CREDENTIALS PROVIDER FOR MANUAL INLINE SIGNUP / LOGIN ENTRIES
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

        // Query the schema model registry safely
        const user = await prisma.user.findUnique({
          where: { email: targetEmail }
        });

        if (!user || !user.password) {
          throw new Error("Identity node record not registered under credentials database.");
        }

        // Validate cryptographically salted password signatures
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error("Invalid decryption handshake: Password mismatch matrix.");
        }

        // Return user context matrix variables cleanly
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      }
    }),

    // 2. Google Identity Provider Node
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    
    // 3. Microsoft Azure AD Provider (Explicit Env Name Mapping)
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID || "common",
    }),
    
    // 4. LinkedIn App Provider via OpenID Connect
    {
      id: "linkedin",
      name: "LinkedIn",
      type: "oauth",
      wellKnown: "https://www.linkedin.com/oauth/.well-known/openid-configuration",
      authorization: {
        params: { scope: "openid profile email" },
      },
      client: {
        token_endpoint_auth_method: "client_secret_post",
      },
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      idToken: true,
      checks: ["state"],
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    },
  ],

  // Override JWT strategy token lifecycle management
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60 // 30 Days active token lifecycle
  },

  secret: process.env.NEXTAUTH_SECRET,
  
  pages: {
    signIn: "/", 
    error: "/",   
  },

  callbacks: {
    // 🧬 Injects DB specific tokens like user ID and system Roles cleanly into the JWT payload
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "user";
      }

      if (account) {
        token.accessToken = account.access_token;
      }
      
      // Auto-profile checker logic for dynamic social login tracking
      if (account && account.provider !== "credentials" && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email }
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },

    // 🌟 Exposes internal variables directly to the useSession() React client hook
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