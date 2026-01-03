const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Select database based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    const mongoUri = isProduction
      ? process.env.MONGODB_URI_PROD
      : process.env.MONGODB_URI_DEV;

    const dbName = isProduction ? 'hicks-prod' : 'hicks-dev';

    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${dbName} (${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'})`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
