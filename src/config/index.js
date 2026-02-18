import "dotenv/config";

export const config = {
    port: process.env.PORT || 3000,
    mongoUri: process.env.MONGODB_URI,
};