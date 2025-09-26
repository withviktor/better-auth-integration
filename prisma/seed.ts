import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@goodhost.com" },
    update: {},
    create: {
      email: "admin@goodhost.com",
      name: "GoodHost Admin",
      password: adminPassword,
      role: Role.SUPER_ADMIN,
    },
  });

  console.log("Created admin user:", admin.email);

  // Create sample servers for the admin
  const sampleServer1 = await prisma.server.upsert({
    where: { id: "sample-minecraft-1" },
    update: {},
    create: {
      id: "sample-minecraft-1",
      name: "Survival Server",
      description: "A vanilla Minecraft survival server",
      gameType: "MINECRAFT_JAVA",
      version: "1.20.1",
      port: 25565,
      maxPlayers: 20,
      motd: "Welcome to Survival!",
      cpuLimit: 2000,
      memoryLimit: 2048,
      diskLimit: 10240,
      ownerId: admin.id,
      status: "OFFLINE",
    },
  });

  const sampleServer2 = await prisma.server.upsert({
    where: { id: "sample-minecraft-2" },
    update: {},
    create: {
      id: "sample-minecraft-2",
      name: "Creative Server",
      description: "A creative building server",
      gameType: "MINECRAFT_JAVA",
      version: "1.20.1",
      port: 25566,
      maxPlayers: 15,
      motd: "Build freely!",
      cpuLimit: 1500,
      memoryLimit: 1536,
      diskLimit: 5120,
      ownerId: admin.id,
      status: "OFFLINE",
    },
  });

  console.log("Created sample servers");

  // Create some sample activities
  await prisma.activity.createMany({
    data: [
      {
        userId: admin.id,
        serverId: sampleServer1.id,
        action: "SERVER_CREATE",
        details: { serverName: sampleServer1.name },
      },
      {
        userId: admin.id,
        serverId: sampleServer2.id,
        action: "SERVER_CREATE",
        details: { serverName: sampleServer2.name },
      },
    ],
  });

  console.log("Created sample activities");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });