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
    container_name: vaultsandbox-gateway-local
    restart: unless-stopped
    ports:
      - '127.0.0.1:2525:25' # SMTP on localhost only
      - '127.0.0.1:8080:80' # HTTP Web UI on localhost only
    environment:
      # Accept emails for any domain (development mode)
      VSB_SMTP_ALLOWED_RECIPIENT_DOMAINS: 'test.localhost'

      # Disable TLS/HTTPS (local development only)
      VSB_CERT_ENABLED: 'false'

      # Optional: Set a fixed API key for convenience (minimum 32 characters)
      # VSB_API_KEY: 'dev-api-key-change-me-at-least-32-chars'
    volumes:
      - gateway-data:/app/data
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  gateway-data:
```

## Starting the Gateway

```bash
# Start the gateway
docker compose up -d

# View logs
docker compose logs -f gateway

# Check health status
curl http://localhost:8080/health
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
	secure: false, // No TLS for local development
	tls: {
		rejectUnauthorized: false,
	},
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

## Retrieving the API Key

On first startup, VaultSandbox generates an API key. Retrieve it from the logs:

```bash
docker compose exec gateway cat /app/data/.api-key; echo
```

Alternatively, set a fixed API key in your `docker-compose.yml` by uncommenting the `VSB_API_KEY` environment variable.

## Using the API

With your API key, you can query captured emails:

```bash
# List all emails
curl -H "X-API-Key: YOUR_API_KEY" http://localhost:8080/api/emails

# Get a specific email
curl -H "X-API-Key: YOUR_API_KEY" http://localhost:8080/api/emails/{id}
```

See the [API Reference](/gateway/api-reference/) for complete documentation.

## Using with VaultSandbox Node.js Client

```javascript
const { VaultSandboxClient } = require('@vaultsandbox/client');

const client = new VaultSandboxClient({
	url: 'http://localhost:8080',
	apiKey: 'YOUR_API_KEY',
});

// Create an inbox (generates a unique email address)
const inbox = await client.createInbox();
console.log('Send emails to:', inbox.emailAddress);

// Wait for an email to arrive
const email = await inbox.waitForEmail({ timeout: 5000 });
console.log('Subject:', email.subject);
console.log('Text:', email.text);

// Cleanup when done
await inbox.delete();
```

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
3. Ensure `VSB_SMTP_ALLOWED_RECIPIENT_DOMAINS` includes your test domain or is set to `*`

## Next Steps

- **[Gateway Configuration](/gateway/configuration/)** - Full environment variable reference
- **[Web UI Guide](/gateway/webui/)** - Browse and inspect captured emails
- **[Node.js Client](/client-node/)** - Programmatic email verification in tests
- **[Docker Compose Setup](/deployment/docker-compose/)** - Production deployment with TLS
