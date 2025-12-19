import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import app from './app.ts';

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
