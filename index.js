
import express from 'express'
import dotenv from 'dotenv'
import { dbConnection } from './db/connection.js';
import { bootStrap } from './src/bootStrap.js';

dotenv.config();
const app = express()

// Middleware
app.use(express.json());

// DB connection
dbConnection();

// routes
bootStrap(app, express);

// Listen locally; Vercel handles this in serverless mode
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

export default app;