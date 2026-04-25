import { connect } from "mongoose";


export const dbConnection = () => {
    connect(process.env.MONGO_URI || process.env.DB_URL, {
        serverSelectionTimeoutMS: 3000, // Fail fast after 3 seconds
        socketTimeoutMS: 3000,
        connectTimeoutMS: 3000,
    })
        .then(() => {
            console.log('✅ MongoDB connected successfully')
        })
        .catch((err) => {
            console.error("❌ Failed to connect to MongoDB:", err.message)
            console.warn("⚠️  Backend will attempt to run without MongoDB")
            console.warn("⚠️  Database operations will fail until MongoDB is available")
        })
}  
