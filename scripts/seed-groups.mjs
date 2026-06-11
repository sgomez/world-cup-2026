import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.development", override: true });
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const BASE_URL = process.env.SEED_BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.LIVE_FEED_TOKEN;

function randInt(max) {
  return Math.floor(Math.random() * (max + 1));
}

function randomMatchData() {
  return { status: "finished", goals1: randInt(5), goals2: randInt(5) };
}

async function putMatch(num, data) {
  const res = await fetch(`${BASE_URL}/api/live/matches/${num}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Match ${num} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function main() {
  if (!TOKEN) {
    console.error("LIVE_FEED_TOKEN not set — add it to .env");
    process.exit(1);
  }

  const { count } = await prisma.liveResult.deleteMany();
  console.log(`Cleaned ${count} live results`);

  for (let num = 1; num <= 72; num++) {
    const data = randomMatchData();
    await putMatch(num, data);
    console.log(`  match ${num.toString().padStart(2)}: ${data.status.padEnd(8)} ${data.goals1}-${data.goals2}`);
  }

  console.log("\nSeeded 72 group phase matches.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
