---
title: Hardened Images
description: Deploy VaultSandbox using security-hardened Docker images with no shell access
---

VaultSandbox offers hardened Docker images for security-conscious deployments. These images have shell access removed, reducing the attack surface for production environments.

## Overview

| Image Tag                            | Shell Access | Use Case                                               |
| ------------------------------------ | ------------ | ------------------------------------------------------ |
| `vaultsandbox/gateway:latest`        | ✅ Yes       | Development, debugging, standard deployments           |
| `vaultsandbox/gateway:latest-harden` | ❌ No        | Production, compliance, security-hardened environments |

:::caution[Key Difference]
Hardened images have **no shell access**. Commands like `docker exec gateway sh` or `docker compose exec gateway cat /app/data/.api-key` will not work. You must configure everything via environment variables and access logs via Docker's logging system.
:::

## Quick Start

```yaml
services:
  gateway:
    image: vaultsandbox/gateway:latest-harden
    ports:
      - '25:25'
      - '80:80'
      - '443:443'
    environment:
      VSB_VSX_DNS_ENABLED: 'true'
      VSB_LOCAL_API_KEY: 'your-secure-api-key-minimum-32-chars'
    volumes:
      - gateway-data:/app/data

volumes:
  gateway-data:
```

## API Key Configuration

Since you cannot execute commands inside the container, **you must provide the API key via environment variable**.

### Generate a Secure API Key

Generate a 32+ character key before deployment:

```bash
# Using OpenSSL
openssl rand -base64 32 | tr -d "=+/" | cut -c1-32

# Using /dev/urandom
head -c 32 /dev/urandom | base64 | tr -d "=+/" | cut -c1-32
```

Example output:

```
7kB9qF2mP5tX8nL3wR6vY1zA4cE0sJ7h
```

### Configure the API Key

**Option 1: Direct in docker-compose.yml**

```yaml
services:
  gateway:
    image: vaultsandbox/gateway:latest-harden
    environment:
      VSB_LOCAL_API_KEY: '7kB9qF2mP5tX8nL3wR6vY1zA4cE0sJ7h'
```

**Option 2: Using .env file (Recommended)**

Create a `.env` file:

```bash
# .env
VSB_LOCAL_API_KEY=7kB9qF2mP5tX8nL3wR6vY1zA4cE0sJ7h
```

Reference in `docker-compose.yml`:

```yaml
services:
  gateway:
    image: vaultsandbox/gateway:latest-harden
    env_file:
      - .env
```

**Option 3: Using Docker Secrets (Production)**

```yaml
services:
  gateway:
    image: vaultsandbox/gateway:latest-harden
    environment:
      VSB_LOCAL_API_KEY_FILE: /run/secrets/api_key
    secrets:
      - api_key

secrets:
  api_key:
    file: ./secrets/api_key.txt
```

:::tip[Security Best Practice]
Never commit API keys to version control. Use `.env` files (add to `.gitignore`) or a secrets manager for production deployments.
:::

### Retrieving an Auto-Generated API Key

If you started a hardened container without setting `VSB_LOCAL_API_KEY`, the gateway will auto-generate one. It's possible to retrieve it using tools like `docker debug` (Docker Desktop) or other debugging techniques, but this is beyond the scope of this guide. For simplicity, always set `VSB_LOCAL_API_KEY` explicitly when using hardened images.

## Accessing Logs

Without shell access, use Docker's logging system to view container logs.

### View Logs

```bash
# Follow logs in real-time
docker compose logs -f gateway

# View last 100 lines
docker compose logs --tail=100 gateway

# View logs since a specific time
docker compose logs --since="2024-01-15T10:00:00" gateway

# View logs with timestamps
docker compose logs -t gateway
```

### Filter Logs

```bash
# Filter for API key confirmation
docker compose logs gateway | grep -i "api key"

# Filter for certificate events
docker compose logs gateway | grep -i "certificate"

# Filter for errors
docker compose logs gateway | grep -i "error"

# Filter for SMTP events
docker compose logs gateway | grep -i "smtp"
```

### Configure Log Output

Control log retention and format in your `docker-compose.yml`:

```yaml
services:
  gateway:
    image: vaultsandbox/gateway:latest-harden
    logging:
      driver: 'json-file'
      options:
        max-size: '10m' # Max 10MB per log file
        max-file: '5' # Keep 5 rotated log files
```

For centralized logging:

```yaml
services:
  gateway:
    image: vaultsandbox/gateway:latest-harden
    logging:
      driver: 'syslog'
      options:
        syslog-address: 'tcp://logserver.example.com:514'
        tag: 'vaultsandbox-gateway'
```

## Health Monitoring

Use Docker's health check and the `/health` endpoint:

```bash
# Check container health status
docker inspect vaultsandbox-gateway --format='{{.State.Health.Status}}'

# View health check logs
docker inspect vaultsandbox-gateway --format='{{json .State.Health}}' | jq

# External health check
curl -f http://localhost/health
```

Configure health checks in `docker-compose.yml`:

```yaml
services:
  gateway:
    image: vaultsandbox/gateway:latest-harden
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Full Production Example

Complete `docker-compose.yml` for hardened production deployment:

```yaml
services:
  gateway:
    image: vaultsandbox/gateway:latest-harden
    container_name: vaultsandbox-gateway
    restart: unless-stopped

    ports:
      - '25:25' # SMTP
      - '80:80' # HTTP (ACME challenges)
      - '443:443' # HTTPS (Web UI + API)

    environment:
      # DNS Configuration (choose one)
      VSB_VSX_DNS_ENABLED: 'true'
      # OR for custom domain:
      # VSB_SMTP_ALLOWED_RECIPIENT_DOMAINS: 'qa.example.com'
      # VSB_CERT_ENABLED: 'true'

      # API Key (required for hardened images)
      VSB_LOCAL_API_KEY: '${VSB_LOCAL_API_KEY}'

      # Optional settings
      VSB_LOCAL_INBOX_MAX_TTL: '604800' # 7 days
      VSB_LOCAL_INBOX_DEFAULT_TTL: '3600' # 1 hour

    volumes:
      - gateway-data:/app/data

    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '5'

volumes:
  gateway-data:
```

With `.env` file:

```bash
# .env
VSB_LOCAL_API_KEY=7kB9qF2mP5tX8nL3wR6vY1zA4cE0sJ7h
```

## VSX DNS Domain Discovery

When using VSX DNS with hardened images, your domain is automatically assigned. Since you can't run commands inside the container, discover your domain through:

**Option 1: Check the VSX DNS Dashboard**

Visit [vsx.email](https://vsx.email) and look up your IP address to find your assigned domain.

**Option 2: Check the Logs**

```bash
docker compose logs gateway | grep -i "domain\|vsx"
```

**Option 3: Via API**

Once you have the domain, verify it via the API:

```bash
curl -H "X-API-Key: your-api-key" https://your-domain.vsx.email/api/inboxes
```

## Migration from Standard Images

To migrate from standard to hardened images:

1. **Export your API key** (if auto-generated):

   ```bash
   # From the standard image container
   docker compose exec gateway cat /app/data/.api-key > ./api-key-backup.txt
   ```

2. **Update your docker-compose.yml**:

   ```yaml
   services:
     gateway:
       image: vaultsandbox/gateway:latest-harden # Changed from :latest
       environment:
         VSB_LOCAL_API_KEY: 'your-exported-api-key' # Add this
   ```

3. **Deploy the hardened image**:
   ```bash
   docker compose pull
   docker compose up -d
   ```

## Troubleshooting

### Cannot Access Container Shell

**Expected behavior.** Hardened images have no shell. Use Docker logs and the `/health` endpoint instead.

### API Key Not Working

**Check logs for API key status:**

```bash
docker compose logs gateway | grep -i "api key"
```

Look for: `[ConfigValidation] ✓ Local API key loaded from environment`

**Verify key format:**

- Must be at least 32 characters
- No extra whitespace or newlines
- Check for copy/paste errors

### Service Won't Start

**Check logs:**

```bash
docker compose logs gateway
```

**Common issues:**

- Missing `VSB_LOCAL_API_KEY` environment variable
- API key shorter than 32 characters
- Port conflicts (25, 80, 443 already in use)

### Cannot Find Assigned VSX Domain

**Check logs for domain assignment:**

```bash
docker compose logs gateway | grep -E "domain|vsx|assigned"
```

**Verify via the VSX dashboard:**

Visit [vsx.email](https://vsx.email) to look up your server's IP address.

## Comparison: Standard vs Hardened

| Feature                 | Standard (`:latest`) | Hardened (`:latest-harden`) |
| ----------------------- | -------------------- | --------------------------- |
| Shell access            | ✅ Available         | ❌ Removed                  |
| API key auto-generation | ✅ Supported         | ⚠️ Requires env var         |
| `docker exec` commands  | ✅ Work              | ❌ No shell                 |
| Log access              | ✅ Logs + exec       | ✅ Docker logs only         |
| Attack surface          | Standard             | Reduced                     |
| Compliance              | Standard             | Enhanced                    |

## Next Steps

- **[Docker Compose Setup](/deployment/docker-compose/)** - Standard deployment guide
- **[API Keys & Authentication](/gateway/api-keys/)** - API key management details
- **[Gateway Configuration](/gateway/configuration/)** - Full configuration reference
- **[Security & Encryption](/gateway/security/)** - Security model deep dive
