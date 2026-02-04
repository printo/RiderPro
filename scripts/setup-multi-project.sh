#!/bin/bash
set -e

# Multi-Project Setup Script for E2E Instance
# Sets up Nginx reverse proxy for multiple projects on single node

echo "🚀 Setting up multi-project hosting on E2E instance..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Get E2E instance IP
E2E_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
echo "📍 E2E Instance IP: $E2E_IP"

# Install Nginx
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing Nginx..."
    apt update
    apt install -y nginx
fi

# Create Nginx directories
echo "📁 Creating Nginx directories..."
mkdir -p /var/www/certbot

# Copy Nginx configs
echo "📋 Setting up Nginx configuration..."
if [ -f "/home/ubuntu/RiderPro/nginx/nginx.conf" ]; then
    cp /home/ubuntu/RiderPro/nginx/nginx.conf /etc/nginx/nginx.conf
fi

if [ -d "/home/ubuntu/RiderPro/nginx/conf.d" ]; then
    cp /home/ubuntu/RiderPro/nginx/conf.d/*.conf /etc/nginx/conf.d/ 2>/dev/null || true
fi

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
nginx -t

# Enable and start Nginx
echo "🚀 Starting Nginx..."
systemctl enable nginx
systemctl restart nginx

# Install Certbot (for Let's Encrypt if not using Cloudflare SSL)
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing Certbot..."
    apt install -y certbot python3-certbot-nginx
fi

# Setup firewall (UFW)
if command -v ufw &> /dev/null; then
    echo "🔥 Configuring firewall..."
    ufw allow 22/tcp    # SSH
    ufw allow 80/tcp    # HTTP
    ufw allow 443/tcp   # HTTPS
    ufw --force enable
fi

echo ""
echo "✅ Multi-project setup complete!"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Configure Cloudflare DNS:"
echo "   - Add A record: riderpro.printo.in → $E2E_IP"
echo "   - Enable proxy (orange cloud) for Cloudflare SSL"
echo "   - Or disable proxy (gray cloud) for Let's Encrypt"
echo ""
echo "2. Get SSL Certificate (if using Let's Encrypt):"
echo "   sudo certbot --nginx -d riderpro.printo.in"
echo ""
echo "3. Test configuration:"
echo "   sudo nginx -t"
echo "   curl http://localhost"
echo ""
echo "4. Check Nginx status:"
echo "   sudo systemctl status nginx"
echo "   sudo tail -f /var/log/nginx/error.log"

