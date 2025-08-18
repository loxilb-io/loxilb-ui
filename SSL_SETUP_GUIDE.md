# SSL/HTTPS Configuration Guide

This document explains how to configure SSL/HTTPS for the loxilb-ui application.

## Quick Start

### 1. HTTPS with Self-Signed Certificates (Default)
```bash
# This will auto-generate self-signed certificates
docker-compose up --build -d

# Or explicitly use the HTTPS configuration
docker-compose -f docker-compose.https.yml up --build -d
```

Access your application:
- HTTP: http://localhost:3000 (redirects to HTTPS)
- HTTPS: https://localhost:3443

### 2. HTTP Only (No SSL)
```bash
docker-compose -f docker-compose.http.yml up --build -d
```

Access your application:
- HTTP: http://localhost:3000

### 3. HTTPS with Commercial Certificates
```bash
# 1. Create SSL directory and add your certificates
mkdir -p ssl
cp your-certificate.pem ssl/cert.pem
cp your-private-key.pem ssl/key.pem

# 2. Deploy with commercial certificates
docker-compose -f docker-compose.commercial.yml up --build -d
```

## SSL Configuration Options

### Environment Variables

- `SSL_MODE=enabled` (default): HTTPS with self-signed certificates
- `SSL_MODE=disabled`: HTTP only
- `SSL_MODE=commercial`: HTTPS with commercial certificates

### Port Configuration

- **Port 3000**: HTTP access (redirects to HTTPS when SSL is enabled)
- **Port 3443**: HTTPS access (only available when SSL is enabled)

## Certificate Management

### Self-Signed Certificates

Self-signed certificates are automatically generated when the container starts. No manual intervention required.

**Browser Warning**: You'll see a security warning in browsers. This is normal for self-signed certificates. You can:
1. Click "Advanced" → "Proceed to localhost (unsafe)"
2. Add a security exception

### Commercial Certificates

1. **Prepare Certificate Files**:
   ```bash
   mkdir -p ssl
   # Place your certificate and private key
   cp your-certificate.pem ssl/cert.pem
   cp your-private-key.pem ssl/key.pem
   ```

2. **Certificate Format Requirements**:
   - Certificate: PEM format (cert.pem)
   - Private Key: PEM format (key.pem)
   - If you have separate certificate chain files, concatenate them:
     ```bash
     cat your-certificate.pem intermediate.pem root.pem > ssl/cert.pem
     ```

3. **Deploy**:
   ```bash
   docker-compose -f docker-compose.commercial.yml up --build -d
   ```

## SSL Management Script

The `ssl-setup.sh` script provides certificate management utilities:

```bash
# Run inside container
docker exec loxilb-ui_loxilb-ui_1 /usr/local/bin/ssl-setup.sh [command]
```

**Commands**:
- `auto` (default): Auto-detect and setup certificates
- `self-signed`: Force generate self-signed certificates
- `commercial`: Use commercial certificates (with fallback to self-signed)
- `validate`: Validate existing certificates

## Security Features

### HTTPS Configuration
- TLS 1.2 and 1.3 support
- Modern cipher suites
- HSTS (HTTP Strict Transport Security)
- Secure headers (X-Frame-Options, CSP, etc.)

### HTTP Security Headers
- `X-Frame-Options`: SAMEORIGIN
- `X-Content-Type-Options`: nosniff
- `X-XSS-Protection`: 1; mode=block
- `Referrer-Policy`: strict-origin-when-cross-origin
- `Content-Security-Policy`: Configured for React app
- `Strict-Transport-Security`: max-age=31536000 (HTTPS only)

## Troubleshooting

### Check Container Logs
```bash
docker-compose logs loxilb-ui
```

### Validate SSL Configuration
```bash
# Check if certificates are properly generated
docker exec loxilb-ui_loxilb-ui_1 ls -la /etc/nginx/ssl/

# Validate certificate
docker exec loxilb-ui_loxilb-ui_1 /usr/local/bin/ssl-setup.sh validate
```

### Test SSL Connection
```bash
# Test HTTPS connection
curl -k https://localhost:3443/health

# Check certificate details
openssl s_client -connect localhost:3443 -servername localhost
```

### Common Issues

1. **Certificate/Key Mismatch**:
   ```bash
   # Regenerate self-signed certificates
   docker exec loxilb-ui_loxilb-ui_1 /usr/local/bin/ssl-setup.sh self-signed
   docker-compose restart loxilb-ui
   ```

2. **Permission Issues**:
   ```bash
   # Fix SSL directory permissions
   chmod 700 ssl/
   chmod 600 ssl/key.pem
   chmod 644 ssl/cert.pem
   ```

3. **Browser Security Warnings** (Self-signed certificates):
   - This is expected behavior
   - For development: Accept the warning and proceed
   - For production: Use commercial certificates

## Production Deployment

For production environments:

1. **Use Commercial Certificates**:
   ```bash
   docker-compose -f docker-compose.commercial.yml up --build -d
   ```

2. **Configure Reverse Proxy** (recommended):
   - Use nginx, Apache, or cloud load balancer
   - Terminate SSL at the proxy level
   - Configure proper domain names and DNS

3. **Security Considerations**:
   - Use strong passwords for certificate private keys
   - Regularly update certificates before expiration
   - Monitor certificate expiration dates
   - Implement proper backup procedures for certificates

## Example nginx Reverse Proxy Configuration

If you want to use an external reverse proxy:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

In this case, run the application in HTTP-only mode:
```bash
docker-compose -f docker-compose.http.yml up --build -d
```
