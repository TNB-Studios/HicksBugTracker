const mongoose = require('mongoose');

// Migrate text index: remove description from text index (HTML content is slow to index)
async function migrateTextIndex(db) {
  try {
    const indexes = await db.collection('tasks').indexes();
    const oldTextIndex = indexes.find(idx =>
      idx.name === 'name_text_description_text' ||
      (idx.key && idx.key._fts === 'text' && idx.weights?.description)
    );

    if (oldTextIndex) {
      console.log('Migrating text index: removing description from text index...');
      await db.collection('tasks').dropIndex(oldTextIndex.name);
      console.log('Old text index dropped. New index (name only) will be created automatically.');
    }
  } catch (error) {
    // Index might not exist, that's fine
    if (!error.message.includes('index not found')) {
      console.error('Error migrating text index:', error.message);
    }
  }
}

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

    // Run migrations
    await migrateTextIndex(conn.connection.db);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
