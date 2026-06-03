import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, magicLink } from "better-auth/plugins";
import { adminAc } from "better-auth/plugins/admin/access";
import { sendMagicLinkEmail } from "./email";
import { prisma } from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail({ email, url });
      },
    }),
    admin({
      adminRoles: ["admin", "super_admin"],
      defaultRole: "user",
      roles: {
        admin: adminAc,
        super_admin: adminAc,
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const count = await prisma.user.count();
          if (count === 1) {
            await prisma.user.update({
              where: { id: user.id },
              data: { role: "super_admin" },
            });
          }
        },
      },
    },
  },
});
