import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import app from './app.ts';

const basePort = Number(process.env.PORT || 3000);

const tryListen = (port: number) => {
  const server = app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
  });
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`Port ${port} in use, trying ${nextPort}...`);
      tryListen(nextPort);
    } else {
      console.error('Server error', err);
    }
  });
};

tryListen(basePort);
