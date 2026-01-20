# VaultSandbox Context

## What is VaultSandbox?

VaultSandbox is a self-hosted email testing platform that lets you validate your complete email stack—including SMTP, TLS, DNS, and authentication—inside your own infrastructure. It replaces fake SMTP servers and public testing services with real mail delivery that behaves exactly like production, without exposing customer data. Emails are encrypted with quantum-safe ML-KEM-768 encryption by default, ensuring only the SDK client can decrypt them.

## Architecture

| Component | Technology | Description |
|-----------|------------|-------------|
| **Gateway** | NestJS + Angular | Receive-only SMTP server with REST API, Web UI, real-time SSE notifications, email authentication (SPF, DKIM, DMARC), and optional spam analysis |
| **CLI** | - | Command-line interface for managing inboxes and emails |
| **SDKs** | Node.js, Python, Java, Go, .NET | Client libraries with automatic quantum-safe encryption |

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Inbox** | Isolated email container identified by email address. Has a TTL (default 1 hour) and optional encryption keypair. |
| **Email** | Captured message with headers, text/HTML body, attachments, links, and authentication results. |
| **Auth Results** | SPF, DKIM, DMARC, and reverse DNS validation results for each email. |
| **Spam Analysis** | Optional Rspamd integration for spam detection with scores and rule matches. |
| **Webhooks** | HTTP callbacks for email events with filtering, templates (Slack/Discord/Teams), and cryptographic signatures. |
| **Real-time Delivery** | Server-Sent Events (SSE) for instant email notifications with smart polling fallback. |

## Common Use Cases

1. **Integration testing** - Validate email flows in automated tests
2. **E2E testing** - Test with real SMTP delivery
3. **Content validation** - Verify email formatting, links, and attachments
4. **Auth testing** - Test SPF, DKIM, DMARC configuration
5. **CI/CD pipelines** - Ephemeral inboxes with automatic cleanup

## SDK Quick Reference

| Language | Package | Import |
|----------|---------|--------|
| Node.js | `@vaultsandbox/client` | `import { VaultSandboxClient } from '@vaultsandbox/client'` |
| Python | `vaultsandbox` | `from vaultsandbox import VaultSandboxClient` |
| Java | `com.vaultsandbox:client` | `import com.vaultsandbox.client.*` |
| Go | `github.com/vaultsandbox/client-go` | `import vaultsandbox "github.com/vaultsandbox/client-go"` |
| .NET | `VaultSandbox.Client` | `using VaultSandbox.Client;` |

## API Endpoints Summary

All endpoints require `X-API-Key` header for authentication.

### Inboxes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/inboxes` | Create inbox (with ML-KEM-768 public key for encryption) |
| `DELETE` | `/api/inboxes/{emailAddress}` | Delete inbox and all emails |
| `DELETE` | `/api/inboxes` | Clear all inboxes (if enabled) |

### Emails

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/inboxes/{emailAddress}/emails` | List emails in inbox |
| `GET` | `/api/inboxes/{emailAddress}/emails/{emailId}` | Get email details |
| `GET` | `/api/inboxes/{emailAddress}/emails/{emailId}/raw` | Get raw email source |
| `DELETE` | `/api/inboxes/{emailAddress}/emails/{emailId}` | Delete single email |
| `PATCH` | `/api/inboxes/{emailAddress}/emails/{emailId}/read` | Mark email as read |

### Real-time & Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/events?inboxes={hashes}` | SSE stream for new email events |
| `POST` | `/api/webhooks` | Create global webhook |
| `POST` | `/api/inboxes/{email}/webhooks` | Create inbox-specific webhook |
| `GET` | `/api/webhooks` | List all global webhooks |

### Server Info

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/server-info` | Get server public key and configuration |
| `GET` | `/api/check-key` | Validate API key |
| `GET` | `/api/metrics` | Get server metrics |
| `GET` | `/health` | Health check |

## Quick Start Example (Node.js)

```javascript
import { VaultSandboxClient } from '@vaultsandbox/client';

const client = new VaultSandboxClient({
  url: 'https://gateway.example.com',
  apiKey: 'your-api-key',
});

// Create inbox (encryption keypair generated automatically)
const inbox = await client.createInbox();

// Send email to inbox.emailAddress from your application...

// Wait for email (uses SSE with polling fallback)
const email = await inbox.waitForEmail({ timeout: 30000 });

console.log('Subject:', email.subject);
console.log('From:', email.from.address);
console.log('Text:', email.text);

// Check authentication results
if (email.authResults.spf.pass) {
  console.log('SPF passed');
}

// Cleanup
await inbox.delete();
```

## Deployment Options

| Mode | Domain | TLS | Use Case |
|------|--------|-----|----------|
| **Localhost** | N/A | HTTP only | Local development |
| **VSX DNS** | Auto-assigned (e.g., `1mzhr2y.vsx.email`) | Auto (Let's Encrypt) | Quick setup, no DNS needed |
| **Custom Domain** | Your domain | Auto (Let's Encrypt) | Branding, compliance |

## Resources

- Documentation: https://vaultsandbox.dev
- Website: https://www.vaultsandbox.com
- GitHub: https://github.com/vaultsandbox/gateway
