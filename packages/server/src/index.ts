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

// Upload endpoint for receiving recordings (pixel videos or DOM JSON/HTML replays)
app.post('/api/upload', upload.any(), (req, res) => {
  const file = (req.files && Array.isArray(req.files) && req.files.length > 0) ? req.files[0] : req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'No recording file provided' });
  }

  const { id, duration, mimeType, discontinueReason, mode } = req.body;

  console.log(`[ShowAndTell Server] Received recording upload:`, {
    filename: file.filename,
    size: file.size,
    duration: `${duration}s`,
    mimeType,
    mode: mode || 'pixel',
    discontinueReason,
    sessionId: id
  });

  return res.json({
    success: true,
    message: 'Recording uploaded successfully',
    file: {
      filename: file.filename,
      size: file.size,
      path: `/api/recordings/${file.filename}`,
      duration,
      mimeType,
      mode: mode || 'pixel',
      discontinueReason
    }
  });
});

// In-memory presigned ticket store for local simulation
interface PresignedTicket {
  filename: string;
  mimeType?: string;
  createdAt: number;
}
const presignedTickets = new Map<string, PresignedTicket>();

// Presigned URL generation endpoint (Simulates AWS S3, Cloudflare R2, Supabase)
app.post('/api/upload/presigned-url', (req, res) => {
  const { filename, mimeType, method = 'PUT' } = req.body;
  const ticketId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const ext = path.extname(filename || '') || (mimeType?.includes('json') ? '.json' : '.webm');
  const savedFilename = `show-and-tell-direct-${ticketId}${ext}`;

  presignedTickets.set(ticketId, {
    filename: savedFilename,
    mimeType,
    createdAt: Date.now()
  });

  const isPost = method.toUpperCase() === 'POST';

  console.log(`[ShowAndTell Server] Generated presigned ${method} ticket:`, {
    ticketId,
    savedFilename,
    mimeType
  });

  if (isPost) {
    // Simulate S3 presigned POST policy form fields
    return res.json({
      url: `/api/upload/direct-post`,
      method: 'POST',
      fields: {
        key: `uploads/${savedFilename}`,
        bucket: 'mock-s3-bucket',
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        ticketId
      },
      publicUrl: `/api/recordings/${savedFilename}`
    });
  }

  // Standard direct PUT (S3 / Cloudflare R2 / Supabase)
  return res.json({
    url: `/api/upload/direct/${ticketId}`,
    method: 'PUT',
    headers: {
      'Content-Type': mimeType || 'video/webm'
    },
    publicUrl: `/api/recordings/${savedFilename}`
  });
});

// Direct streaming PUT upload endpoint (Simulates direct S3 / R2 / Supabase upload)
app.put('/api/upload/direct/:ticketId', (req, res) => {
  const ticket = presignedTickets.get(req.params.ticketId);
  const filename = ticket ? ticket.filename : `show-and-tell-direct-${req.params.ticketId}.webm`;
  const filePath = path.join(uploadsDir, filename);
  const writeStream = fs.createWriteStream(filePath);

  console.log(`[ShowAndTell Server] Streaming direct PUT upload: ${filename}`);

  req.pipe(writeStream);

  writeStream.on('finish', () => {
    const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : { size: 0 };
    console.log(`[ShowAndTell Server] Finished direct PUT upload: ${filename} (${stats.size} bytes)`);
    presignedTickets.delete(req.params.ticketId);
    res.status(200).json({
      success: true,
      message: 'Direct presigned PUT completed',
      url: `/api/recordings/${filename}`,
      size: stats.size
    });
  });

  writeStream.on('error', (err) => {
    console.error(`[ShowAndTell Server] Direct upload stream error:`, err);
    res.status(500).json({ success: false, error: err.message });
  });
});

// Direct multipart POST upload endpoint (Simulates S3 Presigned POST Policy)
app.post('/api/upload/direct-post', upload.any(), (req, res) => {
  const file = (req.files && Array.isArray(req.files) && req.files.length > 0) ? req.files[0] : req.file;
  console.log(`[ShowAndTell Server] Received direct presigned POST form upload:`, {
    filename: file?.filename,
    ticketId: req.body.ticketId
  });

  // S3 Presigned POST returns 204 No Content on success
  res.status(204).end();
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

// Simulation endpoint for demo diagnostics breadcrumbs
app.all('/api/simulate-failure', (req, res) => {
  const status = parseInt(req.query.status as string, 10) || 500;
  res.status(status).json({
    success: false,
    error: req.query.error || 'InternalServerError',
    timestamp: Date.now()
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 ShowAndTell Demo Server running on http://localhost:${PORT}`);
  console.log(`📁 SDK dist path: http://localhost:${PORT}/dist/show-and-tell.min.js`);
  console.log(`🎮 Demo UI: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
