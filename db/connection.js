import { connect } from "mongoose";


export const dbConnection = () => {
    connect(process.env.DB_URL)
        .then(() => {
            console.log('DB connected successfully')
        })
        .catch((err) => {
            console.log("Failed to connect DB", err)
        })
}  
