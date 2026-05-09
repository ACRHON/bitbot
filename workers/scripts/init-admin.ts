/**
 * Seed Script: Create First Admin User
 *
 * Run: npx wrangler d1 execute bitbot-db --local --file=./src/db/schema.sql
 * Then: npx wrangler d1 execute bitbot-db --local --command="SELECT * FROM admin_users"
 *
 * Or use this script to create the first admin:
 * npx wrangler d1 execute bitbot-db --local --command="INSERT INTO admin_users (id, username, password_hash, name, role, created_at) VALUES ('admin1', 'admin', 'hash_123', 'Administrator', 'super_admin', 1713000000000)"
 */

import { createAdminUser } from '../src/db/queries';
import { Env } from '../src/db/queries';

// Simple hash for demo - use bcrypt in production
function hashPassword(password: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'bitbot_salt_2024');
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(16);
}

export async function createFirstAdmin(env: Env): Promise<void> {
  const id = crypto.randomUUID();
  const passwordHash = hashPassword('admin123'); // Change this password!

  await createAdminUser(env, {
    id,
    username: 'admin',
    password_hash: passwordHash,
    name: 'Administrator',
    role: 'super_admin',
    created_at: Date.now(),
  });

  console.log('First admin user created!');
  console.log('Username: admin');
  console.log('Password: admin123');
  console.log('Please change the password after first login!');
}

// To run this, you'd need to call it from a one-time script or Wrangler command
