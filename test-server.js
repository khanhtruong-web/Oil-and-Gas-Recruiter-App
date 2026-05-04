import { execSync } from 'child_process';
try {
  execSync('PORT=3001 NODE_ENV=production node dist/server.cjs', { stdio: 'inherit', timeout: 5000 });
} catch (e) {
  console.log("Error testing server:", e.message);
}
