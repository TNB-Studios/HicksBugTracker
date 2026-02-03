/**
 * One-time migration script to assign task numbers to existing tasks.
 *
 * Run with: node server/migrations/assign-task-numbers.js
 *
 * This script:
 * 1. Finds all tasks without a taskNumber
 * 2. Groups them by board
 * 3. Assigns sequential numbers based on createdAt (oldest first)
 * 4. Updates each board's nextTaskNumber counter
 *
 * Safe to run multiple times - only updates tasks without numbers.
 * Delete this file after running successfully.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

// Connect to MongoDB (same logic as server/config/db.js)
const connectDB = async () => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const mongoUri = isProduction
      ? process.env.MONGODB_URI_PROD
      : process.env.MONGODB_URI_DEV;

    const dbName = isProduction ? 'hicks-prod' : 'hicks-dev';

    await mongoose.connect(mongoUri);
    console.log(`MongoDB connected to ${dbName} (${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'})`);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// Define schemas inline to avoid model conflicts
const taskSchema = new mongoose.Schema({
  taskNumber: Number,
  boardId: mongoose.Schema.Types.ObjectId,
  createdAt: Date
}, { strict: false });

const boardSchema = new mongoose.Schema({
  name: String,
  nextTaskNumber: Number
}, { strict: false });

const Task = mongoose.model('Task', taskSchema);
const Board = mongoose.model('Board', boardSchema);

async function migrate() {
  await connectDB();

  console.log('\n=== Task Number Migration ===\n');

  // Get all boards
  const boards = await Board.find({});
  console.log(`Found ${boards.length} board(s)\n`);

  for (const board of boards) {
    console.log(`Processing board: "${board.name}" (${board._id})`);

    // Find all tasks for this board, sorted by createdAt
    const tasks = await Task.find({ boardId: board._id }).sort({ createdAt: 1 });
    console.log(`  Total tasks: ${tasks.length}`);

    // Filter to only tasks without numbers
    const tasksWithoutNumbers = tasks.filter(t => !t.taskNumber);
    console.log(`  Tasks without numbers: ${tasksWithoutNumbers.length}`);

    if (tasksWithoutNumbers.length === 0) {
      console.log(`  Skipping - all tasks already have numbers\n`);
      continue;
    }

    // Reassign ALL task numbers based on createdAt order
    // This ensures clean sequential numbering by creation date
    let nextNumber = 1;
    let updated = 0;

    for (const task of tasks) {
      const needsUpdate = task.taskNumber !== nextNumber;
      if (needsUpdate) {
        await Task.updateOne(
          { _id: task._id },
          { $set: { taskNumber: nextNumber } }
        );
        updated++;
      }
      nextNumber++;
    }

    // Update board's nextTaskNumber
    await Board.updateOne(
      { _id: board._id },
      { $set: { nextTaskNumber: nextNumber } }
    );

    console.log(`  Assigned numbers 1-${nextNumber - 1} to tasks`);
    console.log(`  Updated ${updated} task(s)`);
    console.log(`  Set nextTaskNumber to ${nextNumber}\n`);
  }

  console.log('=== Migration complete ===\n');

  await mongoose.connection.close();
  console.log('Database connection closed');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
