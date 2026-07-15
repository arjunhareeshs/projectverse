const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dummyPnpmPath = path.join(__dirname, 'pnpm.cmd');
const dummyPnpmContent = '@echo off\nexit 0\n';

try {
  // Create dummy pnpm.cmd
  fs.writeFileSync(dummyPnpmPath, dummyPnpmContent);

  // Prepend current dir to PATH so dummy is found first
  const env = { 
    ...process.env, 
    PATH: `${__dirname}${path.delimiter}${process.env.PATH}` 
  };

  const args = process.argv.slice(2);
  const result = spawnSync('node', ['node_modules/prisma/build/index.js', ...args], { env, stdio: 'inherit', shell: true });

  process.exitCode = result.status || 0;
} finally {
  // Always clean up
  if (fs.existsSync(dummyPnpmPath)) {
    fs.unlinkSync(dummyPnpmPath);
  }
}
