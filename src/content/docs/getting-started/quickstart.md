---
title: Quick Start
description: Get VaultSandbox up and running in under 5 minutes with zero configuration
---

This guide will help you deploy VaultSandbox and send your first test email in under 5 minutes using **VSX DNS** - automatic domain assignment with no DNS configuration required.

## Prerequisites Checklist

Before you begin, ensure you have:

- [ ] **Docker and Docker Compose** installed
- [ ] **Public IP address** with ports 25, 80, and 443 accessible (no NAT/firewall blocking)

That's it! No domain registration or DNS configuration needed.

:::tip[Need a Custom Domain?]
If you need to use your own domain for branding or compliance, see the [Custom Domain Quick Start](/getting-started/quickstart-custom-domain/).
:::

## Step 1: Create Docker Compose Configuration

Create a new directory for VaultSandbox:

```bash
mkdir vaultsandbox && cd vaultsandbox
```

Create a `docker-compose.yml` file with just **1 environment variable**:

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
      test: ['CMD', 'curl', '-f', 'http://localhost:80/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  gateway-data:
```

:::tip[Everything is Automatic]
With VSX DNS enabled, VaultSandbox automatically handles:

- Domain assignment (e.g., `1mzhr2y.vsx.email`)
- DNS configuration with proper MX records
- TLS certificate provisioning via Let's Encrypt
- API key generation
- Email retention (1 hour default, configurable up to 7 days)
  :::

## Step 2: Start VaultSandbox

```bash
docker compose up -d
```

Check that the service is running:

```bash
docker compose ps
```

You should see the `vaultsandbox-gateway` container running.

## Step 3: Discover Your Domain

Your domain is automatically assigned based on your public IP. Find it by:

**Option A:** Enter your IP at [vsx.email](https://vsx.email)

**Option B:** Check the certificate metadata:

```bash
docker compose exec gateway cat /app/data/certificates/metadata.json; echo
```

Your domain will look like `1mzhr2y.vsx.email`.

Retrieve your auto-generated API key:

```bash
docker compose exec gateway cat /app/data/.api-key; echo
```

## Step 4: Access the Web UI

Open your browser and navigate to:

```
https://YOUR-DOMAIN.vsx.email/app
```

:::note[Automatic HTTPS]
VaultSandbox automatically provisions Let's Encrypt certificates on first run. This may take a minute. Once ready, the web UI will be available at the `/app` path with full HTTPS encryption.
:::

You'll be prompted to enter your API key:

![API Key Input](/images/gateway/webui/api-key-input.png)

## Step 5: Create Your First Inbox

In the web UI:

1. Click **"Create Inbox"** button
2. Copy the generated email address (e.g., `a1b2c3d4@1mzhr2y.vsx.email`)
3. Your inbox is ready to receive emails

That's it! Your inbox will automatically capture any emails sent to that address.

![Create Inbox](/images/quick-start/webui-clean.png)

## Step 6: Send a Test Email

Send a test email to your inbox address using any email client or SMTP tool:

```bash
# Using swaks (SMTP testing tool)
swaks --to a1b2c3d4@1mzhr2y.vsx.email \
      --from test@yourdomain.com \
      --server 1mzhr2y.vsx.email \
      --port 25 \
      --h-Subject "Test Email" \
      --body "Hello from VaultSandbox!"
```

Or simply use your regular email client (Gmail, Outlook, etc.) and send to the inbox address.

## Step 7: View Your Email

Go back to the web UI and you should see your email appear in the inbox:

![Inbox View](/images/gateway/webui/inbox-view.png)

Click on it to view:

- Full email content (HTML and plain text)
- All headers
- Extracted links
- Authentication results (SPF, DKIM, DMARC)
- Attachments

![Email Detail View](/images/gateway/webui/email-view.png)

## Verify Production Parity

To confirm VaultSandbox is testing like production, check the authentication results:

1. Send an email from a domain you control with proper SPF/DKIM setup
2. View the email in VaultSandbox
3. Check the **Authentication** section
4. You should see real SPF, DKIM, and DMARC verdicts

:::tip[Authentication Always Failing?]
If authentication checks are failing, it means your sending domain doesn't have proper SPF/DKIM/DMARC records. This is exactly the kind of issue VaultSandbox helps you catch before production!
:::

## Next Steps

Now that VaultSandbox is running, explore more features:

- **[Architecture Overview](/getting-started/architecture/)** - Understand how the zero-knowledge encryption works
- **[Custom Domain Setup](/getting-started/quickstart-custom-domain/)** - Use your own domain instead of VSX DNS
- **[Node.js Client Documentation](/client-node/installation/)** - Integrate email testing into your automated tests
- **[Testing Patterns](/client-node/testing/password-reset/)** - Learn best practices for testing transactional emails

## Troubleshooting

### Domain Not Assigned

1. **Check ports are accessible**: Ports 25, 80, and 443 must be publicly reachable

   ```bash
   # From another machine, test connectivity
   nc -zv YOUR_SERVER_IP 25
   nc -zv YOUR_SERVER_IP 80
   nc -zv YOUR_SERVER_IP 443
   ```

2. **Check logs**:

   ```bash
   docker compose logs gateway
   ```

3. **Verify VSX DNS is enabled**: Ensure `VSB_VSX_DNS_ENABLED: 'true'` is set

### Emails Not Arriving

1. **Check SMTP Port**: Ensure port 25 is not blocked by your hosting provider

   ```bash
   telnet YOUR-DOMAIN.vsx.email 25
   ```

2. **Check Logs**:
   ```bash
   docker compose logs gateway
   ```

### Can't Access Web UI

1. **Check if service is running**:

   ```bash
   docker compose ps
   ```

2. **Check logs**:

   ```bash
   docker compose logs gateway
   ```

3. **Verify HTTPS is ready**: Check logs for "Certificate obtained successfully"

4. **Try HTTP first**: If HTTPS isn't working yet, try `http://YOUR-DOMAIN.vsx.email/app`

### Need Help?

- Learn more about VSX DNS at [vsx.email](https://vsx.email)
- [Open an issue on GitHub](https://github.com/vaultsandbox/gateway/issues)
- Review the [deployment documentation](/deployment/docker-compose/) for more configuration options

## Resources

- **Website**: [www.vaultsandbox.com](https://www.vaultsandbox.com)
- **VSX DNS**: [vsx.email](https://vsx.email)
- **Documentation**: [vaultsandbox.dev](https://vaultsandbox.dev/)
- **GitHub Gateway**: [github.com/vaultsandbox/gateway](https://github.com/vaultsandbox/gateway)
- **Docker Hub**: [hub.docker.com/r/vaultsandbox/gateway](https://hub.docker.com/r/vaultsandbox/gateway)
