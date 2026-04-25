
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

// IMPORTANT: DO NOT listen on Vercel
export default app;