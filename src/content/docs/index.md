---
title: Introduction
description: Production-like email testing. Self-hosted and secure.
---

# Introduction

![Vaultsandbox](/images/vaultsandbox.png)

VaultSandbox is a self-hosted email testing platform that lets you validate your complete email stack—including SMTP, TLS, DNS, and authentication—inside your own infrastructure. It replaces fake SMTP servers and public testing services with real mail delivery that behaves exactly like production, without exposing customer data.

Most email testing tools force you to disable TLS verification, skip DNS checks, or rely on mocks that hide authentication failures. VaultSandbox runs a real SMTP server with Let's Encrypt certificates, validates SPF/DKIM/DMARC on every message, and delivers emails in real-time via Server-Sent Events. All messages are encrypted immediately after parsing using the client's public key (ML-KEM-768) and stored only in encrypted form—the server cannot decrypt them because it never receives the private key.

Designed for CI/CD pipelines, VaultSandbox stores everything in-memory for fast test execution and automatic cleanup. Deploy it with Docker Compose, point your DNS records at it, and start testing with production-like security configurations—no more `rejectUnauthorized: false` hacks or unreliable polling loops.

## Next Steps

1. **[Quick Start](/getting-started/quickstart/)** - Deploy VaultSandbox in under 15 minutes
2. **[Architecture Overview](/getting-started/architecture/)** - Understand the zero-knowledge security model
3. **[Deployment Setup](/deployment/deployment-setup/)** - Infrastructure, DNS, and TLS setup
4. **[Docker Compose Setup](/deployment/docker-compose/)** - Production-ready deployment guide

## Resources

- **Website**: [www.vaultsandbox.com](https://www.vaultsandbox.com)
- **Documentation**: [vaultsandbox.dev](https://vaultsandbox.dev/)
- **GitHub Gateway**: [github.com/vaultsandbox/gateway](https://github.com/vaultsandbox/gateway)
- **GitHub Client Node**: [github.com/vaultsandbox/client-node](https://github.com/vaultsandbox/client-node)
- **Docker Hub**: [hub.docker.com/r/vaultsandbox/gateway](https://hub.docker.com/r/vaultsandbox/gateway)
- **NPM**: [npmjs.com/package/@vaultsandbox/client](https://www.npmjs.com/package/@vaultsandbox/client)
