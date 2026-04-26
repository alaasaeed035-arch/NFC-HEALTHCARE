import { connect } from "mongoose";
import { setDefaultResultOrder, setServers } from "dns";

setServers(["8.8.8.8", "8.8.4.4"]);
setDefaultResultOrder("ipv4first");

export const dbConnection = () => {
    connect(process.env.DB_URL, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000,
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
