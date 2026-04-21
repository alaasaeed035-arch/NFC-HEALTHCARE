import path from 'path'
import express from 'express'
import dotenv from 'dotenv'
import { dbConnection } from './db/connection.js';
import { bootStrap } from './src/bootStrap.js';

const app = express()
const port = process.env.PORT || 3000;
dotenv.config({ path: 'config/.env', debug: false });

// Middleware to parse JSON bodies
app.use(express.json());

// db connection
dbConnection()
// api 
bootStrap(app, express)



app.listen(port, () => console.log(`app listening on port ${port}!`))