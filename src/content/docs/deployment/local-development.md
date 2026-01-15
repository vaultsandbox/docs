---
title: Local Development Setup
description: Run VaultSandbox Gateway locally without HTTPS or public IP for development and testing.
---

# Local Development Setup

This guide covers running VaultSandbox Gateway on your local machine for development purposes. This setup uses HTTP only, requires no public IP address, and runs entirely on localhost.

:::caution[Development Only]
This configuration is intended for local development and basic testing only. Running without HTTPS and a public IP means you cannot:

- **Validate SPF, DKIM, or DMARC** - These DNS-based authentication mechanisms require your server to be publicly accessible
- **Test real email delivery infrastructure** - Your local setup won't receive emails from external mail servers
- **Simulate production TLS behavior** - Certificate handling and HTTPS redirects won't be tested
- **Verify MX record routing** - DNS-based mail routing requires public DNS entries

For production-like testing, see the [Docker Compose Setup](/deployment/docker-compose/) guide with proper TLS and DNS configuration.
:::

## Prerequisites

- Docker Engine 20.10+ and Docker Compose v2.0+
- Ports 2525 (SMTP) and 8080 (HTTP) available on localhost

## Docker Compose Configuration

Create a `docker-compose.yml` file:

```yaml
services:
  gateway:
    image: vaultsandbox/gateway:latest
    ports:
      - '127.0.0.1:2525:25'   # SMTP
      - '127.0.0.1:8080:80'   # HTTP API + Web UI
    volumes:
      - gateway-data:/app/data

volumes:
  gateway-data:
```

That's it — zero environment variables needed for local development. The gateway automatically detects dev mode and configures sensible defaults:

- **Allowed domains**: `localhost`
- **Email authentication**: Disabled (SPF/DKIM/DMARC checks skipped)
- **API key**: Auto-generated and displayed in logs

## Starting the Gateway

```bash
# Start the gateway
docker compose up -d

# View logs
docker compose logs -f gateway

# Check health status
curl http://localhost:8080/health
```

## Retrieving the API Key

The API key is auto-generated on first startup and persisted to a file. Retrieve it with:

```bash
docker compose exec gateway cat /app/data/.api-key; echo
```

Alternatively, set a fixed API key by adding to your `docker-compose.yml`:

```yaml
environment:
  VSB_LOCAL_API_KEY: 'your-api-key-at-least-32-characters-long'
```

## Accessing the Gateway

| Service | URL / Address             |
| :------ | :------------------------ |
| Web UI  | http://localhost:8080/app |
| API     | http://localhost:8080/api |
| SMTP    | localhost:2525            |

## Configuring Your Application

Point your application's SMTP configuration to the local gateway:

```bash
# Environment variables example
SMTP_HOST=localhost
SMTP_PORT=2525
SMTP_SECURE=false
```

### Node.js Example (Nodemailer)

```javascript
const nodemailer = require('nodemailer');
const { VaultSandboxClient } = require('@vaultsandbox/client');

// Create VaultSandbox client
const client = new VaultSandboxClient({
	url: 'http://localhost:8080',
	apiKey: 'YOUR_API_KEY',
});

// Create an inbox to receive emails
const inbox = await client.createInbox();

// Configure Nodemailer to send through local gateway
const transporter = nodemailer.createTransport({
	host: 'localhost',
	port: 2525,
	secure: false,
});

// Send a test email to the inbox's generated address
await transporter.sendMail({
	from: 'test@example.com',
	to: inbox.emailAddress,
	subject: 'Test Email',
	text: 'Hello from local development!',
});

// Wait for the email to arrive
const email = await inbox.waitForEmail({ timeout: 5000 });
console.log('Received:', email.subject);

// Cleanup
await inbox.delete();
```

## Using the API

With your API key, you can query captured emails.

:::tip[Direct API Access Without an SDK]
If no official SDK is available for your language, you can disable response encryption to work directly with the REST API. Add `VSB_ENCRYPTION_ENABLED: 'never'` to your environment variables. This returns plain JSON responses instead of encrypted payloads, making it easier to integrate using standard HTTP clients.
:::

```bash
# List all emails
curl -H "X-API-Key: YOUR_API_KEY" http://localhost:8080/api/emails

# Get a specific email
curl -H "X-API-Key: YOUR_API_KEY" http://localhost:8080/api/emails/{id}
```

See the [API Reference](/gateway/api-reference/) for complete documentation.

## Enabling Local HTTPS (Optional)

If you need to test HTTPS locally (e.g., for secure cookies or service workers), we recommend using [mkcert](https://github.com/FiloSottile/mkcert) — a simple tool for making locally-trusted development certificates.

### Install mkcert

```bash
# macOS
brew install mkcert

# Linux
sudo apt install libnss3-tools
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert

# Windows (with Chocolatey)
choco install mkcert
```

### Generate Certificates

```bash
# Install the local CA (one-time setup)
mkcert -install

# Generate certificates for localhost
mkcert -cert-file localhost.pem -key-file localhost-key.pem localhost 127.0.0.1 ::1

# Ensure the key file is readable by the Docker container
chmod 644 localhost-key.pem
```

:::note[File Permissions]
The private key file must be readable by the Docker container. By default, mkcert creates keys with restrictive permissions (`600`), which will cause a "permission denied" error when the container tries to read it.
:::

### Use with VaultSandbox Gateway

```yaml
services:
  gateway:
    image: vaultsandbox/gateway:latest
    ports:
      - '127.0.0.1:2525:25'   # SMTP
      - '127.0.0.1:8080:80'   # HTTP
      - '127.0.0.1:8443:443'  # HTTPS
    environment:
      VSB_CERT_ENABLED: 'true'
      VSB_TLS_CERT_PATH: '/certs/localhost.pem'
      VSB_TLS_KEY_PATH: '/certs/localhost-key.pem'
    volumes:
      - gateway-data:/app/data
      - ./localhost.pem:/certs/localhost.pem:ro
      - ./localhost-key.pem:/certs/localhost-key.pem:ro

volumes:
  gateway-data:
```

The mkcert CA is automatically trusted by your system browsers and tools after running `mkcert -install`.

## Stopping the Gateway

```bash
# Stop and remove containers
docker compose down

# Stop and remove containers AND data
docker compose down -v
```

## Troubleshooting

### Port Already in Use

If ports 2525 or 8080 are already in use, modify the port mappings:

```yaml
ports:
  - '127.0.0.1:2526:25' # Use port 2526 instead
  - '127.0.0.1:8081:80' # Use port 8081 instead
```

### Connection Refused

Ensure the container is running and healthy:

```bash
docker compose ps
docker compose logs gateway
```

### Emails Not Appearing

1. Verify your application is sending to `localhost:2525`
2. Check the gateway logs for incoming connections
3. Ensure the recipient address ends with `@localhost` (the default in dev mode)

## Next Steps

- **[Gateway Configuration](/gateway/configuration/)** - Full environment variable reference
- **[Web UI Guide](/gateway/webui/)** - Browse and inspect captured emails
- **[Node.js Client](/client-node/)** - Programmatic email verification in tests
- **[Docker Compose Setup](/deployment/docker-compose/)** - Production deployment with TLS
