---
title: Quick Start - Custom Domain
description: Deploy VaultSandbox with your own domain for branding and compliance
---

This guide will help you deploy VaultSandbox using your own domain. This is ideal for production environments, compliance requirements, or when you need custom branding.

:::tip[Want a Faster Setup?]
If you don't need a custom domain, the [Quick Start with VSX DNS](/getting-started/quickstart/) gets you running in under 5 minutes with zero DNS configuration.
:::

## Prerequisites Checklist

Before you begin, ensure you have:

- [ ] **Docker and Docker Compose** installed
- [ ] **A domain or subdomain** you control (e.g., `qa.example.com`)
- [ ] **Public IP address** with ports 25, 80, and 443 accessible
- [ ] **DNS access** to create A and MX records

:::tip[Testing Locally?]
You can run VaultSandbox locally without a public IP for development, but you'll miss production-parity features like real TLS certificates. For full features, see [Deployment Setup](/deployment/deployment-setup/).
:::

## Step 1: Configure DNS

Point your subdomain to the server running VaultSandbox. You'll need two DNS records:

### A Record

Points your subdomain to your server:

```
qa.example.com.  A  YOUR.SERVER.IP
```

### MX Record

Tells email servers to deliver mail for your subdomain to VaultSandbox:

```
qa.example.com.  MX  10  qa.example.com.
```

:::tip[Need Help with DNS Setup?]
Use the **[VaultSandbox DNS Setup Tool](https://www.vaultsandbox.com/setup)** - just enter your server IP and domain, and it will:

- Generate the exact DNS records you need
- Validate your DNS configuration
- Verify your setup is working correctly

This makes DNS setup foolproof!
:::

## Step 2: Create Docker Compose Configuration

Create a new directory for VaultSandbox:

```bash
mkdir vaultsandbox && cd vaultsandbox
```

Create a `docker-compose.yml` file with just **3 environment variables**:

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
      # Just 2 variables - that's it!
      VSB_SMTP_ALLOWED_RECIPIENT_DOMAINS: 'qa.example.com'
      VSB_CERT_ENABLED: 'true'

    volumes:
      - gateway-data:/app/data # Persist certificates and API keys

    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:80/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  gateway-data:
```

:::tip[Everything Else is Automatic]
VaultSandbox automatically handles:

- API key generation (saved in Docker volume)
- TLS certificate provisioning via Let's Encrypt
- Email retention (1 hour default, configurable up to 7 days)
- Security and rate limiting
  :::

## Step 3: Start VaultSandbox

```bash
docker compose up -d
```

Check that the service is running:

```bash
docker compose ps
```

You should see the `vaultsandbox-gateway` container running.

Retrieve your auto-generated API key (you'll need this for the Web UI):

```bash
docker compose exec gateway cat /app/data/.api-key; echo
```

## Step 4: Access the Web UI

Open your browser and navigate to:

```
https://qa.example.com/app
```

:::note[Automatic HTTPS]
VaultSandbox automatically provisions Let's Encrypt certificates on first run. This may take a minute. Once ready, the web UI will be available at the `/app` path with full HTTPS encryption.
:::

You'll be prompted to enter your API key:

![API Key Input](/images/gateway/webui/api-key-input.png)

## Step 5: Create Your First Inbox

In the web UI:

1. Click **"Create Inbox"** button
2. Copy the generated email address (e.g., `a1b2c3d4@qa.example.com`)
3. Your inbox is ready to receive emails

That's it! Your inbox will automatically capture any emails sent to that address.

![Create Inbox](/images/quick-start/webui-clean.png)

## Step 6: Send a Test Email

Send a test email to your inbox address using any email client or SMTP tool:

```bash
# Using swaks (SMTP testing tool)
swaks --to a1b2c3d4@qa.example.com \
      --from test@yourdomain.com \
      --server qa.example.com \
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
- **[Docker Compose Guide](/deployment/docker-compose/)** - Production-ready deployment configurations
- **[Node.js Client Documentation](/client-node/installation/)** - Integrate email testing into your automated tests
- **[Testing Patterns](/client-node/testing/password-reset/)** - Learn best practices for testing transactional emails

## Troubleshooting

### Emails Not Arriving

1. **Use the DNS Setup Tool**: Visit [vaultsandbox.com/setup](https://www.vaultsandbox.com/setup) to verify your DNS configuration

2. **Check DNS manually**: Ensure MX and A records are properly configured

   ```bash
   dig MX qa.example.com
   dig A qa.example.com
   ```

3. **Check SMTP Port**: Ensure port 25 is not blocked by your hosting provider

   ```bash
   telnet qa.example.com 25
   ```

4. **Check Logs**:
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

4. **Try HTTP first**: If HTTPS isn't working yet, try `http://qa.example.com/app`

### Need Help?

- [Open an issue on GitHub](https://github.com/vaultsandbox/gateway/issues)
- Review the [deployment documentation](/deployment/docker-compose/) for more configuration options

## Resources

- **Website**: [www.vaultsandbox.com](https://www.vaultsandbox.com)
- **Documentation**: [vaultsandbox.dev](https://vaultsandbox.dev/)
- **GitHub Gateway**: [github.com/vaultsandbox/gateway](https://github.com/vaultsandbox/gateway)
- **Docker Hub**: [hub.docker.com/r/vaultsandbox/gateway](https://hub.docker.com/r/vaultsandbox/gateway)
