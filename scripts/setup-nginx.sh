#!/bin/bash
set -e

# Setup Nginx for multi-project hosting on E2E instance
# This script configures Nginx as a reverse proxy for multiple projects

echo "🔧 Setting up Nginx for multi-project hosting..."

# Install Nginx
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing Nginx..."
    sudo apt update
    sudo apt install -y nginx
fi

# Create Nginx directories
echo "📁 Creating Nginx directories..."
sudo mkdir -p /home/ubuntu/nginx/conf.d
sudo mkdir -p /home/ubuntu/nginx/certbot/conf
sudo mkdir -p /home/ubuntu/nginx/certbot/www

# Copy Nginx config
echo "📋 Copying Nginx configuration..."
sudo cp nginx/nginx.conf /etc/nginx/nginx.conf
sudo cp nginx/conf.d/*.conf /etc/nginx/conf.d/ 2>/dev/null || true

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
sudo nginx -t

# Enable and start Nginx
echo "🚀 Starting Nginx..."
sudo systemctl enable nginx
sudo systemctl restart nginx

# Install Certbot for SSL
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing Certbot..."
    sudo apt install -y certbot python3-certbot-nginx
fi

echo "✅ Nginx setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update DNS in Cloudflare:"
echo "   - Add A record: riderpro.printo.in → YOUR_E2E_IP"
echo "   - Enable proxy (orange cloud)"
echo ""
echo "2. Get SSL certificate:"
echo "   sudo certbot --nginx -d riderpro.printo.in"
echo ""
echo "3. Test configuration:"
echo "   sudo nginx -t"
echo "   sudo systemctl reload nginx"


