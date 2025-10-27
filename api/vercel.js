// Vercel serverless function wrapper
import app from '../server/vercel.js';

export default function handler(req, res) {
  return app(req, res);
}