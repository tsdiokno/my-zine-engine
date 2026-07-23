import { execSync } from 'child_process';

console.log('Starting Editor App compilation (Build 1)...');

try {
  console.log('Running Vite production compilation...');
  execSync('npx vite build', { stdio: 'inherit' });
  console.log('Editor App compiled successfully into editor/dist!');
} catch (err) {
  console.error('Vite build error:', err.message);
  process.exit(1);
}

