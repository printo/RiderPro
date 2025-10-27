// Simple test function for Vercel
export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Test function working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url
  });
}
