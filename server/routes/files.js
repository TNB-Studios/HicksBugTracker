const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const checkDiskSpace = require('check-disk-space').default;
const Task = require('../models/Task');

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB for regular files
const MAX_VIDEO_FILE_SIZE = 250 * 1024 * 1024; // 250MB for video files
const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mkv'];
const MAX_FILES_PER_UPLOAD = 4;
const MIN_FREE_SPACE_PERCENT = 5; // Reject uploads if less than 5% free
const UPLOAD_DIR = path.join(__dirname, '..', 'Uploaded_Images');

// Check if file is a video based on extension
const isVideoFile = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
};

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const boardId = req.params.boardId;
    const boardDir = path.join(UPLOAD_DIR, boardId);

    // Create board directory if it doesn't exist
    if (!fs.existsSync(boardDir)) {
      fs.mkdirSync(boardDir, { recursive: true });
    }

    cb(null, boardDir);
  },
  filename: (req, file, cb) => {
    // Generate GUID for filename, preserve extension
    const ext = path.extname(file.originalname);
    const guid = uuidv4();
    cb(null, guid + ext);
  }
});

// File filter - check file size based on type
const fileFilter = (req, file, cb) => {
  // We'll check size limits after upload since multer doesn't give us size here
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_VIDEO_FILE_SIZE, // Use higher limit, validate per-file after
    files: MAX_FILES_PER_UPLOAD
  }
});

// Validate file sizes after upload (videos get 250MB, others get 100MB)
const validateUploadedFiles = (files) => {
  const errors = [];
  const validFiles = [];

  for (const file of files) {
    const maxSize = isVideoFile(file.originalname) ? MAX_VIDEO_FILE_SIZE : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      // Delete the oversized file
      fs.unlinkSync(file.path);
      const maxMB = maxSize / (1024 * 1024);
      errors.push(`"${file.originalname}" exceeds ${maxMB}MB limit`);
    } else {
      validFiles.push(file);
    }
  }

  return { validFiles, errors };
};

// Custom error handler for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size is 100MB.`,
        field: err.field
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: `Too many files. Maximum is ${MAX_FILES_PER_UPLOAD} files.`
      });
    }
    return res.status(400).json({ success: false, error: err.message });
  }
  next(err);
};

// @route   POST /api/boards/:boardId/upload
// @desc    Upload files for a board (task or comment)
router.post('/boards/:boardId/upload', async (req, res, next) => {
  try {
    // Check disk space before uploading
    const diskSpace = await checkDiskSpace(UPLOAD_DIR);
    const freePercent = (diskSpace.free / diskSpace.size) * 100;

    if (freePercent < MIN_FREE_SPACE_PERCENT) {
      return res.status(507).json({
        success: false,
        error: `Insufficient disk space. Only ${freePercent.toFixed(1)}% free (minimum ${MIN_FREE_SPACE_PERCENT}% required). Please contact an administrator.`
      });
    }

    // Proceed with upload
    upload.array('files', MAX_FILES_PER_UPLOAD)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: `File "${err.field}" exceeds 100MB limit`,
            oversizedFile: err.field
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            error: `Too many files. Maximum is ${MAX_FILES_PER_UPLOAD} files.`
          });
        }
        return res.status(400).json({ success: false, error: err.message });
      }
      if (err) {
        return next(err);
      }

      // Validate file sizes (videos get 250MB, others get 100MB)
      const { validFiles, errors } = validateUploadedFiles(req.files);

      // Process valid uploaded files
      const uploadedFiles = validFiles.map(file => ({
        fileId: path.basename(file.filename, path.extname(file.filename)),
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        filename: file.filename
      }));

      // Return with any size validation errors
      if (errors.length > 0 && validFiles.length === 0) {
        return res.status(400).json({
          success: false,
          error: errors.join('. ')
        });
      }

      res.json({
        success: true,
        data: uploadedFiles,
        warnings: errors.length > 0 ? errors : undefined
      });
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/tasks/:taskId/files
// @desc    Add uploaded files to a task
router.post('/tasks/:taskId/files', async (req, res, next) => {
  try {
    const { files } = req.body;

    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Check if adding these files would exceed the limit
    if (task.files.length + files.length > 4) {
      return res.status(400).json({
        success: false,
        error: `Cannot add ${files.length} files. Task already has ${task.files.length} files (max 4).`
      });
    }

    // Add files to task
    task.files.push(...files.map(f => ({
      fileId: f.fileId,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size
    })));

    await task.save();
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/tasks/:taskId/files/:fileId
// @desc    Remove a file from a task
router.delete('/tasks/:taskId/files/:fileId', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const fileIndex = task.files.findIndex(f => f.fileId === req.params.fileId);
    if (fileIndex === -1) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Get file info before removing
    const file = task.files[fileIndex];
    const boardId = task.boardId.toString();

    // Remove from task
    task.files.splice(fileIndex, 1);
    await task.save();

    // Delete physical file
    const boardDir = path.join(UPLOAD_DIR, boardId);
    const files = fs.readdirSync(boardDir);
    const physicalFile = files.find(f => f.startsWith(req.params.fileId));
    if (physicalFile) {
      fs.unlinkSync(path.join(boardDir, physicalFile));
    }

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/tasks/:taskId/comments/:commentId/files
// @desc    Add uploaded files to a comment
router.post('/tasks/:taskId/comments/:commentId/files', async (req, res, next) => {
  try {
    const { files } = req.body;

    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const comment = task.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    // Check if adding these files would exceed the limit
    if (comment.files.length + files.length > 4) {
      return res.status(400).json({
        success: false,
        error: `Cannot add ${files.length} files. Comment already has ${comment.files.length} files (max 4).`
      });
    }

    // Add files to comment
    comment.files.push(...files.map(f => ({
      fileId: f.fileId,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size
    })));

    await task.save();
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/tasks/:taskId/comments/:commentId/files/:fileId
// @desc    Remove a file from a comment
router.delete('/tasks/:taskId/comments/:commentId/files/:fileId', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const comment = task.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    const fileIndex = comment.files.findIndex(f => f.fileId === req.params.fileId);
    if (fileIndex === -1) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const boardId = task.boardId.toString();

    // Remove from comment
    comment.files.splice(fileIndex, 1);
    await task.save();

    // Delete physical file
    const boardDir = path.join(UPLOAD_DIR, boardId);
    const files = fs.readdirSync(boardDir);
    const physicalFile = files.find(f => f.startsWith(req.params.fileId));
    if (physicalFile) {
      fs.unlinkSync(path.join(boardDir, physicalFile));
    }

    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/boards/:boardId/files/:fileId
// @desc    Get/download a file
router.get('/boards/:boardId/files/:fileId', async (req, res, next) => {
  try {
    const boardDir = path.join(UPLOAD_DIR, req.params.boardId);

    if (!fs.existsSync(boardDir)) {
      return res.status(404).json({ success: false, error: 'Board directory not found' });
    }

    // Find file by GUID (fileId is the GUID without extension)
    const files = fs.readdirSync(boardDir);
    const file = files.find(f => f.startsWith(req.params.fileId));

    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const filePath = path.join(boardDir, file);
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
