---
title: Docker Compose Setup
description: Deploy VaultSandbox using Docker Compose with production-ready configurations
---

This guide covers deploying VaultSandbox using Docker Compose, from basic development setups to production-ready configurations.

## Quick Start

Choose your setup method:

| Method            | Variables | DNS Setup | Best For                              |
| ----------------- | --------- | --------- | ------------------------------------- |
| **VSX DNS**       | 1         | Automatic | Quick testing, CI/CD, getting started |
| **Custom Domain** | 2         | Manual    | Production, compliance, branding      |

### Option 1: VSX DNS (Simplest)

Zero-config setup with automatic domain assignment. Just **1 environment variable**:

```yaml
services:
  gateway:
    image: vaultsandbox/gateway:latest
    ports:
      - '25:25'
      - '80:80'
      - '443:443'
    environment:
      VSB_VSX_DNS_ENABLED: 'true'
    volumes:
      - gateway-data:/app/data

volumes:
  gateway-data:
```

```bash
docker compose up -d
```

Your domain is automatically assigned (e.g., `1mzhr2y.vsx.email`). Find it at [vsx.email](https://vsx.email) or run:

```bash
docker compose exec gateway cat /app/data/certificates/metadata.json; echo
```

### Option 2: Custom Domain

Use your own domain with just **2 environment variables**:

```yaml
services:
  gateway:
    image: vaultsandbox/gateway:latest
    ports:
      - '25:25'
      - '80:80'
      - '443:443'
    environment:
      VSB_SMTP_ALLOWED_RECIPIENT_DOMAINS: 'qa.example.com'
      VSB_CERT_ENABLED: 'true'
    volumes:
      - gateway-data:/app/data

volumes:
  gateway-data:
```

**Requires DNS setup**: Create A and MX records pointing to your server. See [Custom Domain Quick Start](/getting-started/quickstart-custom-domain/) for details.

---

VaultSandbox runs as a single unified gateway service that includes the SMTP server, API, and web UI all in one container.

## Configuration Reference

### VSX DNS Mode

| Variable              | Description                                                              |
| --------------------- | ------------------------------------------------------------------------ |
| `VSB_VSX_DNS_ENABLED` | Set to `true` to enable automatic DNS via [vsx.email](https://vsx.email) |

### Custom Domain Mode

| Variable                             | Description                                     | Example                           |
| ------------------------------------ | ----------------------------------------------- | --------------------------------- |
| `VSB_SMTP_ALLOWED_RECIPIENT_DOMAINS` | Domains to accept emails for (comma-separated)  | `qa.example.com,test.example.com` |
| `VSB_CERT_ENABLED`                   | Enable automatic Let's Encrypt TLS certificates | `true`                            |

### Optional Configuration

Override defaults for advanced use cases:

| Variable                      | Default      | Description                                         |
| ----------------------------- | ------------ | --------------------------------------------------- |
| `VSB_LOCAL_INBOX_MAX_TTL`     | `604800`     | Max email retention in seconds (7 days)             |
| `VSB_LOCAL_INBOX_DEFAULT_TTL` | `3600`       | Default inbox TTL in seconds (1 hour)               |
| `VSB_LOCAL_CLEANUP_INTERVAL`  | `300`        | Cleanup interval for expired inboxes (5 min)        |
| `VSB_SMTP_PORT`               | `25`         | SMTP port (must be 25 for real email)               |
| `VSB_SERVER_PORT`             | `80`         | HTTP port for ACME challenges                       |
| `VSB_SERVER_HTTPS_PORT`       | `443`        | HTTPS port for Web UI and API                       |
| `VSB_SERVER_ORIGIN`           | _(auto)_     | CORS origins (auto-derived from domain, or use `*`) |
| `VSB_DATA_PATH`               | `/app/data`  | Path for certificates and API keys                  |
| `NODE_ENV`                    | `production` | Node environment                                    |

:::tip[Getting Your API Key]
**Security Note:** API keys are never logged to the console. The key is saved in the Docker volume at `/app/data/.api-key`.

To retrieve it from the container:

```bash
# Using Docker Compose
docker compose exec gateway cat /app/data/.api-key; echo

# Or using Docker CLI
docker exec vaultsandbox-gateway cat /app/data/.api-key; echo
```

You can check logs to confirm _when_ it was generated:

```bash
docker compose logs gateway | grep "API key"
```

:::

## Basic Deployment

### Step 1: Create Configuration

```bash
mkdir vaultsandbox && cd vaultsandbox
```

Create `docker-compose.yml`. Choose your mode:

**VSX DNS (recommended for getting started):**

```yaml
services:
  gateway:
    image: vaultsandbox/gateway:latest
    container_name: vaultsandbox-gateway
    restart: unless-stopped

    ports:
      - '25:25' # SMTP
      - '80:80' # HTTP (ACME + VSX verification)
      - '443:443' # HTTPS (Web UI + API)

    environment:
      VSB_VSX_DNS_ENABLED: 'true'

    volumes:
      - gateway-data:/app/data

    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  gateway-data:
```

**Custom Domain:**

```yaml
services:
  gateway:
    image: vaultsandbox/gateway:latest
    container_name: vaultsandbox-gateway
    restart: unless-stopped

    ports:
      - '25:25' # SMTP
      - '80:80' # HTTP (ACME challenges)
      - '443:443' # HTTPS (Web UI + API)

    environment:
      VSB_SMTP_ALLOWED_RECIPIENT_DOMAINS: 'qa.example.com'
      VSB_CERT_ENABLED: 'true'

    volumes:
      - gateway-data:/app/data

    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  gateway-data:
```

### Step 2: Start the Gateway

```bash
docker-compose up -d
```

### Step 3: Verify Service

```bash
# Check service status
docker compose ps

# View logs
docker compose logs -f gateway

# Check health endpoint
curl http://localhost/health

# Get your API key
docker compose exec gateway cat /app/data/.api-key; echo
```

### Step 4: Access Web UI

Navigate to `https://qa.example.com/app` (or your domain).

:::tip[HTTPS is Automatic]
VaultSandbox automatically provisions Let's Encrypt certificates on first startup. This takes 1-2 minutes. The web UI is served at the `/app` path with full HTTPS encryption.
:::

## Production Deployment

Production deployments typically use **Custom Domain** mode for branding and compliance.

### Step 1: Create Production Configuration

```bash
mkdir vaultsandbox && cd vaultsandbox
```

Create `docker-compose.yml` with production settings:

```yaml
services:
  gateway:
    image: vaultsandbox/gateway:latest
    container_name: vaultsandbox-gateway
    restart: unless-stopped

    ports:
      - '25:25' # SMTP
      - '80:80' # HTTP (ACME challenges)
      - '443:443' # HTTPS (Web UI + API)

    environment:
      # Core configuration
      VSB_SMTP_ALLOWED_RECIPIENT_DOMAINS: 'qa.example.com,staging.example.com'
      VSB_CERT_ENABLED: 'true'

      # Optional production settings
      VSB_LOCAL_INBOX_MAX_TTL: '604800' # 7 days
      VSB_SERVER_ORIGIN: 'https://qa.example.com' # Restrict CORS

    volumes:
      - gateway-data:/app/data # Persist certificates and API keys

    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    # Resource limits (adjust based on your needs)
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

    # Logging configuration
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'

volumes:
  gateway-data:
```

### Step 2: Start the Gateway

```bash
docker-compose up -d
```

### Step 3: Monitor Logs

```bash
# Follow logs
docker compose logs -f gateway

# Check for errors
docker compose logs gateway | grep ERROR

# Verify certificate provisioning
docker compose logs gateway | grep -i certificate
```

## Advanced Configuration

### Health Checks

VaultSandbox includes built-in health checks:

```yaml
healthcheck:
  test: ['CMD', 'curl', '-f', 'http://localhost/health']
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

Customize health check behavior:

```yaml
healthcheck:
  interval: 60s # Check every 60 seconds
  timeout: 5s # Timeout after 5 seconds
  retries: 5 # Retry 5 times before marking unhealthy
  start_period: 60s # Wait 60s before starting checks
```

### Logging Configuration

Control log output:

```yaml
logging:
  driver: 'json-file'
  options:
    max-size: '10m' # Max 10MB per log file
    max-file: '3' # Keep 3 log files
```

Or use syslog:

```yaml
logging:
  driver: 'syslog'
  options:
    syslog-address: 'tcp://192.168.0.42:514'
```

## Managing Services

### Start Services

```bash
docker compose up -d
```

### Stop Services

```bash
docker compose stop
```

### Restart Service

```bash
docker compose restart

# Or restart gateway specifically
docker compose restart gateway
```

### View Logs

```bash
# Follow logs
docker compose logs -f gateway

# Last 100 lines
docker compose logs --tail=100 gateway

# Filter for specific events
docker compose logs gateway | grep -i "certificate\|api key\|error"
```

### Update Images

```bash
# Pull latest images
docker compose pull

# Restart with new images
docker compose up -d
```

### Remove Services

```bash
# Stop and remove containers
docker compose down

# Remove containers and volumes (WARNING: deletes all data)
docker compose down -v
```

## Troubleshooting

### Service Won't Start

**Check logs**:

```bash
docker compose logs gateway
```

**Common issues**:

- Port 25 already in use (another mail server running)
- Ports 80/443 already in use
- Invalid domain configuration in `VSB_SMTP_ALLOWED_RECIPIENT_DOMAINS`

### Cannot Access Web UI

**Check if gateway is running**:

```bash
docker compose ps gateway
```

**Test from server**:

```bash
curl http://localhost/health
curl http://localhost/app
```

**Check DNS**:

```bash
dig A qa.example.com
```

**Access web UI at correct path**: Remember the UI is at `/app`, not root:

```
https://qa.example.com/app
```

### Certificate Errors

**Check certificate logs**:

```bash
docker compose logs gateway | grep -i certificate
```

**Common issues**:

- Ports 80/443 not accessible from internet
- DNS not pointing to server
- Domain validation timeout

**Disable certificates for local testing**:

```yaml
environment:
  VSB_CERT_ENABLED: 'false'
```

### Emails Not Received

**Check SMTP logs**:

```bash
docker compose logs gateway | grep -i smtp
```

**Test SMTP connection**:

```bash
telnet qa.example.com 25
```

**Verify MX records**:

```bash
dig MX qa.example.com
```

**Use the DNS Setup Tool**: Visit [vaultsandbox.com/setup](https://www.vaultsandbox.com/setup) to verify your DNS configuration.

### High Memory Usage

**Check current usage**:

```bash
docker stats vaultsandbox-gateway
```

**Reduce resource limits**:

```yaml
deploy:
  resources:
    limits:
      memory: 2G # Reduce from 4G
```

**Reduce email retention**:

```yaml
environment:
  VSB_LOCAL_INBOX_MAX_TTL: '86400' # 24 hours instead of 7 days
```

### Container Keeps Restarting

**Check logs**:

```bash
docker compose logs gateway --tail=50
```

**Check health status**:

```bash
docker inspect vaultsandbox-gateway | grep Health -A 10
```

**Disable health checks temporarily**:

```yaml
healthcheck:
  disable: true
```

### Can't Find API Key

**Check API key from container**:

```bash
docker compose exec gateway cat /app/data/.api-key; echo
```

**Check logs**:

```bash
docker compose logs gateway | grep -i "api key"
```

**If file doesn't exist**: Remove the volume and restart to regenerate:

```bash
docker compose down
docker volume rm vaultsandbox_gateway-data  # Or your volume name
docker compose up -d
```

## Performance Tuning

### Resource Allocation

For different workload sizes:

**Light (< 1000 inboxes)**:

```yaml
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 2G
```

**Medium (1000-5000 inboxes)**:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 4G
```

**Heavy (5000+ inboxes)**:

```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 8G
```

### Email Retention Configuration

Shorter TTL = less memory usage:

```yaml
environment:
  # 1 hour (good for CI/CD pipelines)
  VSB_LOCAL_INBOX_MAX_TTL: "3600"

  # 24 hours (good for manual testing)
  VSB_LOCAL_INBOX_MAX_TTL: "86400"

  # 7 days (default, good for staging)
  VSB_LOCAL_INBOX_MAX_TTL: "604800"
```

## Security Hardening

### API Key Management

VaultSandbox automatically generates a secure API key on first startup. The key is persisted to a Docker volume at `/app/data/.api-key`.

**Retrieve your API key**:

```bash
# From Docker container
docker compose exec gateway cat /app/data/.api-key; echo

# Or using Docker CLI
docker exec vaultsandbox-gateway cat /app/data/.api-key; echo
```

**Rotate API key**:

```bash
# Delete the key file from inside the container
docker compose exec gateway rm /app/data/.api-key

# Restart the gateway to generate a new key
docker compose restart gateway

# Retrieve the new key
docker compose exec gateway cat /app/data/.api-key; echo
```

**For production deployments**:

- Explicitly set `VSB_LOCAL_API_KEY` in your environment to use a custom key
- Use `VSB_LOCAL_API_KEY_STRICT=true` to require manual configuration

### Restrict CORS Origins

For production, restrict CORS to specific origins:

```yaml
environment:
  VSB_SERVER_ORIGIN: 'https://qa.example.com,https://app.example.com'
```

### Use Firewall Rules

Only expose necessary ports:

```bash
# Allow required ports
sudo ufw allow 25/tcp   # SMTP
sudo ufw allow 80/tcp   # HTTP (ACME)
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable

# Deny all other incoming traffic
sudo ufw default deny incoming
```

## Next Steps

- **[Deployment Setup](/deployment/deployment-setup/)** - DNS and TLS configuration
- **[Node.js Client](/client-node/installation/)** - Integrate with your tests
- **[Gateway Configuration](/gateway/configuration/)** - Advanced gateway settings

## Resources

- **Website**: [www.vaultsandbox.com](https://www.vaultsandbox.com)
- **GitHub Gateway**: [github.com/vaultsandbox/gateway](https://github.com/vaultsandbox/gateway)
- **Docker Hub**: [hub.docker.com/r/vaultsandbox/gateway](https://hub.docker.com/r/vaultsandbox/gateway)
