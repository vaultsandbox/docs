---
title: Deployment Setup
description: Complete guide to setting up VaultSandbox infrastructure, DNS, and TLS certificates
---

This guide covers everything you need to deploy VaultSandbox: infrastructure requirements, DNS configuration, and automatic TLS certificate provisioning.

## Infrastructure Requirements

### Public IP Address

**Required for**: Production-parity testing

**Why it matters**:

- ACME certificate issuance requires HTTP-01 or TLS-ALPN-01 challenge
- Real SMTP servers need to connect to port 25 from the internet
- SPF/DKIM validation requires legitimate DNS resolution

**Without a public IP**:

- You can still run VaultSandbox locally for development
- Email authentication checks will be limited

### Open Ports

VaultSandbox requires the following ports to be accessible:

| Port | Protocol | Purpose                 | Required For     |
| ---- | -------- | ----------------------- | ---------------- |
| 25   | SMTP     | Inbound email           | Email delivery   |
| 80   | HTTP     | ACME challenges, Web UI | TLS certificates |
| 443  | HTTPS    | Secure API and Web UI   | Production use   |

:::caution[Port 25 Inbound May Be Blocked]
VaultSandbox needs **inbound port 25 access** so other SMTP servers can deliver emails to it. Many cloud providers block inbound port 25 by default to prevent spam operations.

**What's typically blocked**:

- Port 25 outbound: Blocks sending spam (VaultSandbox doesn't need this)
- Port 25 inbound: Blocks receiving email (VaultSandbox **requires this**)

**Solutions**:

- Request port 25 inbound access (AWS EC2 via support ticket)
- Use specific instance types/zones (GCP varies by zone)
- Use a VPS provider that allows port 25 (DigitalOcean, Linode, Hetzner)

**Test inbound port 25 availability**:

```bash
# From ANOTHER machine, test connecting to your server
nc -zv YOUR_SERVER_IP 25
```

:::

### Domain or Subdomain

**Required for**: DNS-based email delivery

**What you need**:

- A domain you control (e.g., `example.com`)
- OR a subdomain (e.g., `test.example.com` or `qa.example.com`)
- Access to modify DNS records (A and MX records)

**Examples**:

```
# Full domain for testing
example.com → VaultSandbox
Inboxes: user@example.com

# Subdomain for testing
qa.example.com → VaultSandbox
Inboxes: user@qa.example.com
```

### DNS Control

You need the ability to create:

1. **A Record**: Points your domain to the server's IP address

   ```
   qa.example.com.  A  192.0.2.1
   ```

2. **MX Record**: Tells email servers where to deliver mail
   ```
   example.com.  MX  10  qa.example.com.
   ```

:::tip[Using a Subdomain?]
You can isolate VaultSandbox to a subdomain for testing:

```
# Create subdomain for testing
qa.example.com.  A  192.0.2.1
qa.example.com.  MX  10  qa.example.com.

# Inboxes will be: user@qa.example.com
```

:::

:::tip[Need Help with DNS Setup?]
Use the **[VaultSandbox DNS Setup Tool](https://www.vaultsandbox.com/setup)** - just enter your server IP and domain, and it will:

- Generate the exact DNS records you need
- Validate your DNS configuration
- Verify your setup is working correctly

This makes DNS setup foolproof!
:::

## TLS Certificates (Automatic)

VaultSandbox automatically provisions and renews TLS certificates using Let's Encrypt - **no manual configuration needed**.

**How it works**:

1. Enable ACME in your `.env` file:
   ```bash
   VSB_SMTP_ALLOWED_RECIPIENT_DOMAINS=qa.example.com
   VSB_CERT_ENABLED=true
   VSB_CERT_EMAIL=admin@example.com
   ```
2. VaultSandbox requests certificates via HTTP-01 challenge
3. Let's Encrypt validates domain ownership (requires port 80 accessible)
4. Certificate issued and automatically renewed 30 days before expiry

**Requirements**:

- Port 80 accessible from internet (for ACME validation)
- Port 443 accessible for HTTPS
- DNS A record pointing to your server

**That's it!** HTTPS will be enabled automatically at `https://qa.example.com`

## System Requirements

### Minimum Hardware

For light testing and development:

- **CPU**: 1 core (2 cores recommended)
- **RAM**: 1GB (2GB recommended)
- **Disk**: 1GB for Docker images (VaultSandbox runs in-memory)
- **Network**: 10 Mbps

:::note[In-Memory Storage]
VaultSandbox stores all emails in RAM. More RAM = more concurrent inboxes and emails.
:::

## Software Requirements

### Docker & Docker Compose

**Required versions**:

- Docker: 20.10+ (latest version recommended)
- Docker Compose: 1.29+ or `docker compose` plugin (v2)

**Installation**:

```bash
# Check versions
docker --version
docker-compose --version
# or
docker compose version

# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose v2 (plugin)
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

### Operating System

VaultSandbox runs on any OS that supports Docker:

- **Linux**: Ubuntu 20.04+, Debian 11+, CentOS 8+, Fedora 34+
- **macOS**: macOS 11+ (for local development only)
- **Windows**: Windows 10+ with WSL2 (for local development only)

:::caution[Production Deployment]
For production-parity testing, deploy on **Linux** with a public IP. macOS and Windows are suitable for local development only.
:::

## Network Requirements

### Firewall Configuration

Ensure your firewall allows:

```bash
# Allow SMTP (port 25)
sudo ufw allow 25/tcp

# Allow HTTP (port 80) - ACME challenges
sudo ufw allow 80/tcp

# Allow HTTPS (port 443)
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

### Security Groups (Cloud)

If using cloud providers, configure security groups:

**Inbound Rules**:

- Port 25 (SMTP) - Source: `0.0.0.0/0`
- Port 80 (HTTP) - Source: `0.0.0.0/0`
- Port 443 (HTTPS) - Source: `0.0.0.0/0`
- Port 22 (SSH) - Source: Your IP (for management)

**Outbound Rules**:

- Allow all outbound (for ACME challenges and updates)

## DNS Provider Compatibility

VaultSandbox works with any DNS provider. Popular options:

- **Cloudflare**: Fast propagation, free tier available
- **AWS Route 53**: AWS integration, programmable DNS
- **Google Cloud DNS**: GCP integration
- **DigitalOcean DNS**: Free with DigitalOcean droplets
- **Namecheap, GoDaddy, etc.**: All standard DNS providers work

:::tip[DNS Propagation Time]
After creating DNS records, allow 5-60 minutes for propagation. Check status:

```bash
dig A qa.example.com
dig MX example.com
```

:::

## Optional Requirements

:::note[VaultSandbox Only Receives Email]
VaultSandbox is designed to **receive and store emails for testing** — it never sends emails. This means you **do not need** SPF, DKIM, DMARC, or other sender authentication records for VaultSandbox itself.

Your application sends emails → VaultSandbox receives them → You test via API/UI

Configure SPF/DKIM on your **sending application's domain**, not on VaultSandbox's domain.
:::

### Reverse DNS (PTR Record)

**What it is**: Maps an IP address back to a hostname

**Why it helps**:

- Some sending SMTP servers check reverse DNS before delivering
- Can improve email acceptance rates from strict servers
- Generally optional for testing purposes

**How to set it up**:

- Contact your hosting provider (usually requires support ticket)
- Set PTR record: `192.0.2.1 → qa.example.com`

**Test reverse DNS**:

```bash
dig -x 192.0.2.1
```

## Pre-Deployment Checklist

Before deploying VaultSandbox, verify:

- [ ] Public IP address acquired
- [ ] Port 25 confirmed open (test with telnet/nc)
- [ ] Ports 80 and 443 accessible
- [ ] Domain or subdomain ready
- [ ] DNS provider access confirmed
- [ ] Docker and Docker Compose installed
- [ ] Firewall rules configured
- [ ] (Optional) Reverse DNS requested

## Testing Without Public IP (Local Development)

You can run VaultSandbox locally for development:

```bash
docker-compose up
```

**Limitations**:

- No TLS certificates (ACME requires public IP and domain)
- Cannot receive emails from external SMTP servers
- Must send test emails from same machine

**For local testing**:

```bash
# Send test email locally
swaks --to test@localhost \
      --from user@example.com \
      --server localhost \
      --port 25 \
      --body "Local test"
```

:::tip[Local Development]
Local mode is great for:

- Developing integrations with the Node.js client
- Testing client logic
- Prototyping email workflows

For full production-parity testing, deploy with a public IP.
:::

## Next Steps

Once you've confirmed all requirements and configured DNS:

1. **[Docker Compose Setup](/deployment/docker-compose/)** - Deploy VaultSandbox with Docker
2. **[Quick Start](/getting-started/quickstart/)** - Send your first test email

- **[API Reference](/gateway/api-reference/)** - Integrate with your application

## Troubleshooting

### How do I check if port 25 is open?

```bash
# From another machine
telnet YOUR_SERVER_IP 25

# Or using nc
nc -zv YOUR_SERVER_IP 25

# Expected output: "Connected to YOUR_SERVER_IP"
```

### My cloud provider blocks port 25

**Options**:

1. Request unblocking (AWS, GCP support tickets)
2. Switch to a VPS provider that allows port 25 (DigitalOcean, Hetzner, Linode)
3. Use an SMTP relay service (not recommended for testing)

### How do I test DNS propagation?

```bash
# Test A record
dig A qa.example.com

# Test MX record
dig MX example.com

# Use external DNS checker
https://dnschecker.org
```

## Resources

- **Website**: [www.vaultsandbox.com](https://www.vaultsandbox.com)
- **GitHub Gateway**: [github.com/vaultsandbox/gateway](https://github.com/vaultsandbox/gateway)
- **Docker Hub**: [hub.docker.com/r/vaultsandbox/gateway](https://hub.docker.com/r/vaultsandbox/gateway)
