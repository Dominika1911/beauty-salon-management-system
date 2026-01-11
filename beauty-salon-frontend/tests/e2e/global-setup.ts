import { execSync } from 'node:child_process';
import path from 'node:path';

export default async function globalSetup() {
  // Ten setup seeduje osobnych userów dla projektów: Desktop/Tablet/Mobile,
  // żeby testy nie gryzły się rezerwacjami.
  const backendDir =
    process.env.E2E_BACKEND_DIR ||
    path.resolve(process.cwd(), '../beauty-salon-backend');

  const password = process.env.E2E_PASS || 'E2Epass123!';

  const users = [
    'e2e-client-desktop',
    'e2e-client-tablet',
    'e2e-client-mobile',
  ];

  for (const username of users) {
    execSync(`py manage.py seed_e2e --username ${username} --password ${password}`, {
      cwd: backendDir,
      stdio: 'inherit',
    });
  }
}
