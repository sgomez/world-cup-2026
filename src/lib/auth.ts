import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";
import { promoteFirstRegistrant } from "@/modules/user/application/promote-first-registrant";
import { PrismaUserRepository } from "@/modules/user/infrastructure/prisma-user-repository";
import { prisma } from "./prisma";

const ac = createAccessControl(defaultStatements);

// Admins get every admin permission except impersonation; only super_admins may
// impersonate users (and admins).
const adminRole = ac.newRole({
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "delete",
    "set-password",
    "get",
    "update",
  ],
  session: ["list", "revoke", "delete"],
});

const superAdminRole = ac.newRole({
  ...adminAc.statements,
  user: [...adminAc.statements.user, "impersonate-admins"],
});

export const auth = betterAuth({
  advanced: {
    trustedProxyHeaders: true,
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  plugins: [
    admin({
      ac,
      adminRoles: ["admin", "super_admin"],
      defaultRole: "user",
      roles: {
        admin: adminRole,
        super_admin: superAdminRole,
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const repo = new PrismaUserRepository(prisma);
          await promoteFirstRegistrant(repo, { userId: user.id });
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
