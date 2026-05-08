import { readFileSync } from 'fs';
import { resolve } from 'path';
import { MongoClient } from 'mongodb';

// load .env
const envContent = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  const v = t.slice(eq + 1).trim();
  if (!process.env[k]) process.env[k] = v;
}

async function main() {
  const client = new MongoClient(process.env.LEGACY_MONGO_DB_URL!);
  await client.connect();
  const db = client.db();

  const docs = await db.collection('shortlinks').find({}).limit(3).toArray();
  for (const doc of docs) {
    console.log(JSON.stringify(doc, null, 2));
    console.log('---');
  }

  await client.close();
}

main();
