// Starts the server (API) and the client (website) together. Ctrl+C stops both.
const { spawn } = require('child_process');
const path = require('path');

const procs = ['server', 'client'].map((dir) =>
  spawn(process.execPath, [dir === 'server' ? 'server.js' : 'serve.js'], {
    cwd: path.join(__dirname, dir),
    stdio: 'inherit',
  })
);

const stop = () => { procs.forEach((p) => p.kill()); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach((p) => p.on('exit', (code) => { if (code) stop(); }));
