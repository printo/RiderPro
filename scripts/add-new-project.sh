#!/bin/bash
set -e

# Script to add a new project to multi-project setup
# Usage: ./add-new-project.sh project-name frontend-port backend-port

if [ $# -lt 3 ]; then
    echo "Usage: $0 <project-name> <frontend-port> <backend-port>"
    echo "Example: $0 project2 5005 8005"
    exit 1
fi

PROJECT_NAME=$1
FRONTEND_PORT=$2
BACKEND_PORT=$3
DOMAIN="${PROJECT_NAME}.yourdomain.com"

echo "🚀 Adding new project: $PROJECT_NAME"
echo "   Frontend port: $FRONTEND_PORT"
echo "   Backend port: $BACKEND_PORT"
echo "   Domain: $DOMAIN"

# Create Nginx config from template
echo "📋 Creating Nginx configuration..."
sed "s/PROJECT_NAME/$PROJECT_NAME/g; s/FRONTEND_PORT/$FRONTEND_PORT/g; s/BACKEND_PORT/$BACKEND_PORT/g" \
    /home/ubuntu/riderpro/nginx/conf.d/project-template.conf > \
    /etc/nginx/conf.d/${PROJECT_NAME}.conf

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
nginx -t

# Reload Nginx
echo "🔄 Reloading Nginx..."
systemctl reload nginx

echo "✅ Project $PROJECT_NAME added!"
echo ""
echo "📝 Next steps:"
echo "1. Add DNS record in Cloudflare:"
echo "   Type: A"
echo "   Name: $PROJECT_NAME"
echo "   Content: YOUR_E2E_IP"
echo "   Proxy: 🟠 Proxied"
echo ""
echo "2. Get SSL certificate (if using Let's Encrypt):"
echo "   sudo certbot --nginx -d $DOMAIN"
echo ""
echo "3. Update docker-compose.yml in /home/ubuntu/$PROJECT_NAME:"
echo "   frontend: ports: - \"$FRONTEND_PORT:5004\""
echo "   django: ports: - \"$BACKEND_PORT:8000\""

