import { useState, useRef, useEffect, useCallback } from 'react';
import { fileApi } from '../../services/api';
import './FileUpload.css';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_VIDEO_FILE_SIZE = 250 * 1024 * 1024; // 250MB for videos
const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mkv'];
const MAX_FILES = 4;

export default function FileUpload({
  boardId,
  files = [],
  onFilesChange,
  onUploadComplete,
  disabled = false
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [fullscreenMedia, setFullscreenMedia] = useState(null); // { type: 'image' | 'video', url, name }
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);

  const remainingSlots = MAX_FILES - files.length;

  // Close fullscreen on ESC key
  const handleEscKey = useCallback((e) => {
    if (e.key === 'Escape' && fullscreenMedia) {
      setFullscreenMedia(null);
    }
  }, [fullscreenMedia]);

  useEffect(() => {
    if (fullscreenMedia) {
      document.addEventListener('keydown', handleEscKey);
      return () => document.removeEventListener('keydown', handleEscKey);
    }
  }, [fullscreenMedia, handleEscKey]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Check if file is a video based on extension
  const isVideoFile = (filename) => {
    const ext = '.' + filename.split('.').pop().toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
  };

  const validateFiles = (fileList) => {
    const validFiles = [];
    const errors = [];

    for (const file of fileList) {
      const maxSize = isVideoFile(file.name) ? MAX_VIDEO_FILE_SIZE : MAX_FILE_SIZE;
      const maxMB = maxSize / (1024 * 1024);
      if (file.size > maxSize) {
        errors.push(`"${file.name}" exceeds ${maxMB}MB limit`);
      } else {
        validFiles.push(file);
      }
    }

    // Check if we'd exceed max files
    if (validFiles.length > remainingSlots) {
      errors.push(`Can only add ${remainingSlots} more file(s) (max ${MAX_FILES})`);
      validFiles.splice(remainingSlots);
    }

    return { validFiles, errors };
  };

  const handleUpload = async (fileList) => {
    if (disabled || uploading || fileList.length === 0) return;

    const { validFiles, errors } = validateFiles(fileList);

    if (errors.length > 0) {
      setError(errors.join('. '));
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    }

    if (validFiles.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const response = await fileApi.upload(boardId, validFiles);
      const uploadedFiles = response.data.data;

      if (onUploadComplete) {
        onUploadComplete(uploadedFiles);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
      setTimeout(() => setError(null), 5000);
    } finally {
      setUploading(false);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && remainingSlots > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || remainingSlots === 0) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleUpload(droppedFiles);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleUpload(selectedFiles);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleDeleteFile = (fileId) => {
    if (onFilesChange) {
      onFilesChange(files.filter(f => f.fileId !== fileId));
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (mimeType) => {
    if (!mimeType) return '📄';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎬';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
    return '📄';
  };

  // Check if file is a displayable image
  const isDisplayableImage = (file) => {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.tga', '.bmp'];
    const fileName = (file.originalName || '').toLowerCase();
    return imageExtensions.some(ext => fileName.endsWith(ext));
  };

  // Check if file is playable audio
  const isPlayableAudio = (file) => {
    const audioExtensions = ['.mp3', '.wav', '.ogg'];
    const fileName = (file.originalName || '').toLowerCase();
    return audioExtensions.some(ext => fileName.endsWith(ext));
  };

  // Check if file is playable video
  const isPlayableVideo = (file) => {
    const fileName = (file.originalName || '').toLowerCase();
    return VIDEO_EXTENSIONS.some(ext => fileName.endsWith(ext));
  };

  // Open media in fullscreen
  const openFullscreen = (file, type) => {
    setFullscreenMedia({
      type,
      url: getFileUrl(file.fileId),
      name: file.originalName
    });
  };

  const getFileUrl = (fileId) => {
    return fileApi.getUrl(boardId, fileId);
  };

  const toggleAudio = (fileId) => {
    if (playingAudioId === fileId) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingAudioId(null);
    } else {
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
      }
      // Start playing new audio
      const audio = new Audio(getFileUrl(fileId));
      audio.onended = () => {
        setPlayingAudioId(null);
        audioRef.current = null;
      };
      audio.play();
      audioRef.current = audio;
      setPlayingAudioId(fileId);
    }
  };

  return (
    <div className="file-upload">
      {/* Existing files */}
      {files.length > 0 && (
        <div className="file-list">
          {files.map(file => (
            <div key={file.fileId} className={`file-item ${isDisplayableImage(file) || isPlayableVideo(file) ? 'file-item-media' : ''}`}>
              {isDisplayableImage(file) ? (
                <div className="file-thumbnail">
                  <img
                    src={getFileUrl(file.fileId)}
                    alt={file.originalName}
                    style={{ width: 300, height: 'auto', cursor: 'pointer' }}
                    onClick={() => openFullscreen(file, 'image')}
                    title="Click to view fullscreen"
                  />
                  <div className="file-thumbnail-info">
                    <span className="file-name" title={file.originalName}>
                      {file.originalName}
                    </span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                    {!disabled && (
                      <button
                        type="button"
                        className="file-delete"
                        onClick={() => handleDeleteFile(file.fileId)}
                        title="Remove file"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>
              ) : isPlayableVideo(file) ? (
                <div className="file-video">
                  <video
                    src={getFileUrl(file.fileId)}
                    style={{ width: 300, height: 'auto' }}
                    controls
                  />
                  <div className="file-thumbnail-info">
                    <button
                      type="button"
                      className="video-fullscreen-btn"
                      onClick={() => openFullscreen(file, 'video')}
                      title="Fullscreen"
                    >
                      &#x26F6;
                    </button>
                    <span className="file-name" title={file.originalName}>
                      {file.originalName}
                    </span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                    {!disabled && (
                      <button
                        type="button"
                        className="file-delete"
                        onClick={() => handleDeleteFile(file.fileId)}
                        title="Remove file"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <span className="file-icon">{getFileIcon(file.mimeType)}</span>
                  {isPlayableAudio(file) && (
                    <button
                      type="button"
                      className={`audio-play-btn ${playingAudioId === file.fileId ? 'playing' : ''}`}
                      onClick={() => toggleAudio(file.fileId)}
                      title={playingAudioId === file.fileId ? 'Stop' : 'Play'}
                    >
                      {playingAudioId === file.fileId ? '⏹' : '▶'}
                    </button>
                  )}
                  <span className="file-name" title={file.originalName}>
                    {file.originalName}
                  </span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                  {!disabled && (
                    <button
                      type="button"
                      className="file-delete"
                      onClick={() => handleDeleteFile(file.fileId)}
                      title="Remove file"
                    >
                      &times;
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {remainingSlots > 0 && !disabled && (
        <div
          className={`file-dropzone ${isDragging ? 'dragging' : ''} ${uploading ? 'uploading' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {uploading ? (
            <span className="upload-status">Uploading...</span>
          ) : (
            <>
              <span className="dropzone-text">
                Drop files here or{' '}
                <button
                  type="button"
                  className="file-browse-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  browse
                </button>
              </span>
              <span className="dropzone-hint">
                Max 100MB (250MB for videos), {remainingSlots} slot{remainingSlots !== 1 ? 's' : ''} remaining
              </span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* Error message */}
      {error && <div className="file-error">{error}</div>}

      {/* Fullscreen modal */}
      {fullscreenMedia && (
        <div className="fullscreen-overlay" onClick={() => setFullscreenMedia(null)}>
          <button
            className="fullscreen-close"
            onClick={() => setFullscreenMedia(null)}
            title="Close (ESC)"
          >
            &times;
          </button>
          {fullscreenMedia.type === 'image' ? (
            <img
              src={fullscreenMedia.url}
              alt={fullscreenMedia.name}
              className="fullscreen-media"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <video
              src={fullscreenMedia.url}
              className="fullscreen-media"
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}
