#!/usr/bin/env node
const { execSync } = require('child_process');

console.log('Building for Electron...');

try {
  // Step 1: Run Next.js build
  console.log('Running Next.js build...');
  execSync('next build', { stdio: 'inherit' });

  // Step 2: Run electron-builder
  const args = process.argv.slice(2).join(' ');
  const builderCmd = args ? `npx electron-builder ${args}` : 'npx electron-builder';
  console.log(`Running ${builderCmd}...`);
  execSync(builderCmd, { stdio: 'inherit' });

  console.log('Build complete!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
