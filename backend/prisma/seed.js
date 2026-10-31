import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL;
  const superAdminName = process.env.SEED_SUPER_ADMIN_NAME;
  const superAdminPhone = process.env.SEED_SUPER_ADMIN_PHONE;
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD;

  const roles = await Promise.all(
    [
      "SUPER_ADMIN",
      "SOCIETY_ADMIN",
      "SECURITY_GUARD",
      "FLAT_OWNER"
    ].map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: {
          name,
          description: name.replaceAll("_", " ").toLowerCase()
        }
      })
    )
  );

  const roleByName = Object.fromEntries(
    roles.map((role) => [role.name, role])
  );

  console.log("Roles created successfully");

  const hasSuperAdminSeed =
    superAdminEmail ||
    superAdminName ||
    superAdminPhone ||
    superAdminPassword;

  if (!hasSuperAdminSeed) {
    console.log("Super Admin user skipped. Set SEED_SUPER_ADMIN_* env values to create one.");
    return;
  }

  if (!superAdminEmail || !superAdminName || !superAdminPhone || !superAdminPassword) {
    throw new Error("Set SEED_SUPER_ADMIN_EMAIL, SEED_SUPER_ADMIN_NAME, SEED_SUPER_ADMIN_PHONE, and SEED_SUPER_ADMIN_PASSWORD together.");
  }

  if (superAdminPassword.length < 12) {
    throw new Error("SEED_SUPER_ADMIN_PASSWORD must be at least 12 characters.");
  }

  const passwordHash = await bcrypt.hash(superAdminPassword, 12);

  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {
      roleId: roleByName.SUPER_ADMIN.id,
      passwordHash,
      status: "ACTIVE"
    },
    create: {
      roleId: roleByName.SUPER_ADMIN.id,
      name: superAdminName,
      email: superAdminEmail,
      phone: superAdminPhone,
      passwordHash,
      status: "ACTIVE"
    }
  });

  console.log("Super Admin user created or updated");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
