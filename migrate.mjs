import { execSync } from 'child_process';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const dbUrlMatch = envFile.match(/DATABASE_URL="(.*?)"/);
if (dbUrlMatch) {
  process.env.DATABASE_URL = dbUrlMatch[1];
  console.log("Found DB URL, running migrations...");
  try {
    execSync('npx drizzle-kit generate', { stdio: 'inherit' });
    execSync('npx drizzle-kit migrate', { stdio: 'inherit' });
    execSync('npm run db:seed', { stdio: 'inherit' });
  } catch(e) {
    console.error("Failed:", e.message);
  }
} else {
  console.error("No DATABASE_URL found");
}
