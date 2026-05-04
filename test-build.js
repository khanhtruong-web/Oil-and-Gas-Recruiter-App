import { execSync } from 'child_process';
try {
  execSync('npm run build', { env: { ...process.env, NODE_ENV: 'production', npm_config_production: 'true' }, stdio: 'inherit' });
} catch (e) {
  console.log("Error:", e.message);
}
