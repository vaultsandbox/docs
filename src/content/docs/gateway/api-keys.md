---
title: API Key & Authentication
description: Understanding and managing your VaultSandbox API key
---

VaultSandbox uses a single API key to authenticate all client requests. This guide covers how the API key works, how it's generated, and how to use it securely.

## How It Works

The API key provides simple, secure authentication for all API requests:

```
┌─────────────────────────────────────────────────────────────┐
│                  API Key Authentication Flow                │
└─────────────────────────────────────────────────────────────┘

1. Client Request
   ┌─────────┐                              ┌─────────────┐
   │ Client  │ ── POST /api/inboxes ──────→ │   Gateway   │
   │         │    Header: X-API-Key: abc123 │             │
   └─────────┘                              └─────────────┘

2. Gateway Validates Key
                                           ┌─────────────┐
                                           │   Gateway   │
                                           │             │
                                           │ ✓ Valid?
                                           └─────────────┘

3. Response
   ┌─────────┐                              ┌─────────────┐
   │ Client  │ ←── 201 Created ──────────── │   Gateway   │
   │         │     { inbox data }           │             │
   └─────────┘                              └─────────────┘
```

**What the API key controls**:

- ✅ Create and manage inboxes
- ✅ Receive and read emails
- ✅ Delete inboxes and emails
- ✅ Subscribe to real-time notifications

**What it cannot do**:

- ❌ Send outbound emails (VaultSandbox is receive-only)
- ❌ Modify gateway configuration

## Automatic Generation

On first startup, VaultSandbox automatically generates a secure API key and saves it to the data directory.

### Getting Your API Key

On first startup, an API key is automatically generated and saved to `${VSB_DATA_PATH}/.api-key`
(default: `/app/data/.api-key`) inside the Docker volume.

**Security Note:** API keys are never logged to stdout/container logs. To retrieve your API key:

```bash
# Using Docker Compose
docker compose exec gateway cat /app/data/.api-key; echo

# Using Docker CLI
docker exec vaultsandbox-gateway cat /app/data/.api-key; echo

# If using custom VSB_DATA_PATH
docker compose exec gateway cat $VSB_DATA_PATH/.api-key
```

The startup logs will confirm the key was loaded:
`[ConfigValidation] ✓ Local API key loaded from generated`

For production deployments, explicitly set `VSB_LOCAL_API_KEY` in your environment or use
`VSB_LOCAL_API_KEY_STRICT=true` to require manual configuration.

## Manual Generation

You can generate your own API key and configure VaultSandbox to use it. API keys must be at least 32 characters long.

### Generate a Secure Key with OpenSSL

```bash
# Generate a random 32-character API key
openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
```

Example output:

```
7kB9qF2mP5tX8nL3wR6vY1zA4cE0sJ7h
```

### Configure the Gateway to Use Your Key

**Option 1: Using Environment Variable**

Add to your `docker-compose.yml`:

```yaml
services:
  gateway:
    environment:
      VSB_LOCAL_API_KEY: '7kB9qF2mP5tX8nL3wR6vY1zA4cE0sJ7h'
```

**Option 2: Using .env File**

```bash
# .env
VSB_LOCAL_API_KEY=7kB9qF2mP5tX8nL3wR6vY1zA4cE0sJ7h
```

Then reference in `docker-compose.yml`:

```yaml
services:
  gateway:
    env_file:
      - .env
```

:::tip[Best Practice]
For production deployments, use **Option 1** (environment variable) to explicitly set your API key. This ensures the key is managed through your deployment configuration and prevents auto-generation.
:::

## Using the API Key

Include the API key in the `X-API-Key` header for all requests.

### cURL Example

```bash
curl https://mail.example.com/api/inboxes \
  -H "X-API-Key: 7kB9qF2mP5tX8nL3wR6vY1zA4cE0sJ7h"
```

### Using Environment Variables

Store your API key in environment variables:

```bash
# .env
VAULTSANDBOX_URL=https://mail.example.com
VAULTSANDBOX_API_KEY=7kB9qF2mP5tX8nL3wR6vY1zA4cE0sJ7h
```

Then use in your scripts:

```bash
curl $VAULTSANDBOX_URL/api/inboxes \
  -H "X-API-Key: $VAULTSANDBOX_API_KEY"
```

### CI/CD Integration

**GitHub Actions**:

```yaml
name: Email Tests
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run email tests
        env:
          VAULTSANDBOX_API_KEY: ${{ secrets.VAULTSANDBOX_API_KEY }}
        run: npm test
```

**GitLab CI**:

```yaml
test:
  script:
    - npm test
  variables:
    VAULTSANDBOX_API_KEY: $VAULTSANDBOX_API_KEY
```

Store API keys in CI/CD secrets, never in workflow files.

## Security Best Practices

### Storing API Keys

**✅ DO**:

- Store in environment variables
- Use secret management tools (AWS Secrets Manager, Vault, etc.)
- Use Docker secrets for production deployments
- Use password managers for manual storage

**❌ DON'T**:

- Hard-code in source code
- Commit to version control
- Share via email or chat
- Log API keys in plain text

### Using API Keys

**✅ DO**:

- Always use HTTPS for requests
- Rotate keys periodically
- Use separate keys for different environments (dev, staging, prod)
- Monitor for unauthorized access

**❌ DON'T**:

- Reuse keys across environments
- Use keys in client-side JavaScript (browser)
- Transmit keys over unencrypted connections

## Key Rotation

For enhanced security, rotate your API key periodically.

### When to Rotate

- **Development**: As needed
- **Staging**: Every 90 days
- **Production**: Every 30-90 days
- **Immediately**: If key is compromised

### How to Rotate

See the **[Docker Compose Deployment](/deployment/docker-compose/)** guide for detailed instructions on rotating your API key, including:

- Deleting and regenerating the key
- Managing permissions

## Troubleshooting

### Invalid API Key

**Error**: `401 Unauthorized: Invalid API key`

**Causes**:

- API key is incorrect or malformed
- `X-API-Key` header is missing or misspelled

**Solutions**:

1. Verify the key matches what's in the container:
   ```bash
   docker compose exec gateway cat /app/data/.api-key; echo
   ```
2. Check for extra whitespace or newlines in the key
3. Ensure header is set: `X-API-Key: your-key` (case-sensitive)
4. Test with cURL to isolate the issue:
   ```bash
   API_KEY=$(docker compose exec gateway cat /app/data/.api-key)
   curl -v https://mail.example.com/api/inboxes \
     -H "X-API-Key: $API_KEY"
   ```

### Can't Find API Key

**Problem**: The API key file doesn't exist

**Solutions**:

1. **Check the logs**:

   ```bash
   docker compose logs gateway | grep -i "api key"
   ```

2. **Verify data directory exists in container**:

   ```bash
   docker compose exec gateway ls -la /app/data
   ```

3. **If file is missing, regenerate**:
   ```bash
   docker compose down
   docker volume rm vaultsandbox_gateway-data  # Adjust volume name if needed
   docker compose up -d
   # New key will be auto-generated
   ```

## Next Steps

- **[Docker Compose Setup](/deployment/docker-compose/)** - Deploy with Docker Compose and manage API keys
- **[Gateway Configuration](/gateway/configuration/)** - Configure gateway settings
- **[Security](/gateway/security/)** - Deep dive into security model
- **[Node.js Client Installation](/client-node/installation/)** - Use the SDK for seamless API key handling
