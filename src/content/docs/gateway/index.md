---
title: Gateway
description: Overview of the VaultSandbox Gateway - a receive-only SMTP server for testing environments
---

The Gateway is a receive-only SMTP server designed for QA and testing environments. It accepts incoming emails, validates authentication (SPF, DKIM, DMARC, reverse DNS), and stores them with configurable retention.

## Key Capabilities

- **SMTP Reception**: Receive-only server on port 25 with automatic TLS via Let's Encrypt
- **Email Authentication**: Full SPF, DKIM, DMARC, and reverse DNS validation on every message
- **Web Interface**: Angular-based UI at `/app` for viewing emails and authentication results
- **REST API**: Programmatic access to emails with auto-generated API keys
- **Configurable Retention**: Default 7-day TTL, adjustable via environment variables

## Architecture

The Gateway runs as a single container with two integrated components:

- **Backend (NestJS)**: SMTP server, certificate management, REST API, serves the frontend
- **Frontend (Angular)**: Email viewer, authentication results display, inbox management

```
┌─────────────────────────────────────┐
│  Frontend (Angular)                 │
│  - Served at /app                   │
│  - API calls via /api               │
└──────────────┬──────────────────────┘
               │ HTTP(S)
┌──────────────▼──────────────────────┐
│  Backend (NestJS)                   │
│  - REST API (/api)                  │
│  - SMTP Server (port 25)            │
│  - Let's Encrypt certificates       │
└─────────────────────────────────────┘
```

## Requirements

- Public IP with ports 25, 80, and 443 accessible
- DNS control for your testing domain (A record + MX record)
- Docker (recommended) or Node.js 18+

## Links

- [GitHub Repository](https://github.com/vaultsandbox/gateway)
- [Docker Hub](https://hub.docker.com/r/vaultsandbox/gateway)

## Next Steps

- [Configuration](/gateway/configuration/) - Environment variables and setup options
- [API Keys](/gateway/api-keys/) - Authentication for the REST API
- [API Reference](/gateway/api-reference/) - REST API endpoints
- [Security](/gateway/security/) - Security features and considerations
