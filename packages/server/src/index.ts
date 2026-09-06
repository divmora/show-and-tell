import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for video file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `show-and-tell-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Serve SDK distribution files
app.use('/dist', express.static(path.resolve(__dirname, '../../sdk/dist')));

// Serve Demo client
app.use(express.static(path.resolve(__dirname, '../../../demo')));

// Upload endpoint for receiving recordings
app.post('/api/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No video file provided' });
  }

  const { id, duration, mimeType, discontinueReason } = req.body;

  console.log(`[ShowAndTell Server] Received recording upload:`, {
    filename: req.file.filename,
    size: req.file.size,
    duration: `${duration}s`,
    mimeType,
    discontinueReason,
    sessionId: id
  });

  return res.json({
    success: true,
    message: 'Recording uploaded successfully',
    file: {
      filename: req.file.filename,
      size: req.file.size,
      path: `/api/recordings/${req.file.filename}`,
      duration,
      mimeType,
      discontinueReason
    }
  });
});

// Serve uploaded video recordings
app.use('/api/recordings', express.static(uploadsDir));

// List uploaded recordings
app.get('/api/recordings-list', (_req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir).map(filename => {
      const stats = fs.statSync(path.join(uploadsDir, filename));
      return {
        filename,
        size: stats.size,
        createdAt: stats.birthtime,
        url: `/api/recordings/${filename}`
      };
    });
    res.json({ success: true, recordings: files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 ShowAndTell Demo Server running on http://localhost:${PORT}`);
  console.log(`📁 SDK dist path: http://localhost:${PORT}/dist/show-and-tell.min.js`);
  console.log(`🎮 Demo UI: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
