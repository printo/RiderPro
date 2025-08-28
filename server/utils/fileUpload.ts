import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
const signaturesDir = path.join(uploadsDir, 'signatures');
const photosDir = path.join(uploadsDir, 'photos');

[uploadsDir, signaturesDir, photosDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = file.fieldname === 'signature' ? signaturesDir : photosDir;
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const extension = path.extname(file.originalname) || '.png';
    const filename = `${randomUUID()}${extension}`;
    cb(null, filename);
  }
});

// File filter for images
const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Helper function to get file URL
export function getFileUrl(filename: string, type: 'signature' | 'photo'): string {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${baseUrl}/uploads/${type}s/${filename}`;
}

// Helper function to convert base64 to file
export function saveBase64File(base64Data: string, type: 'signature' | 'photo'): string {
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 data');
  }

  const mimeType = matches[1];
  const base64Content = matches[2];
  const extension = mimeType.includes('png') ? '.png' : '.jpg';
  
  const filename = `${randomUUID()}${extension}`;
  const dir = type === 'signature' ? signaturesDir : photosDir;
  const filePath = path.join(dir, filename);
  
  const buffer = Buffer.from(base64Content, 'base64');
  fs.writeFileSync(filePath, buffer);
  
  return filename;
}
