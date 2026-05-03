import express from 'express'
import dotenv from 'dotenv'
import { dbConnection } from './db/connection.js'
import { bootStrap } from './src/bootStrap.js'

dotenv.config()
const app = express()

// Ensure DB is connected before every request (serverless-safe: reuses cached connection on warm starts)
app.use(async (req, res, next) => {
  try {
    await dbConnection()
    next()
  } catch (err) {
    console.error('DB unavailable:', err.message)
    res.status(503).json({ success: false, message: 'Database unavailable. Please try again.' })
  }
})

bootStrap(app, express)

// Vercel handles listening in serverless mode; only bind locally
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`))
}

export default app
