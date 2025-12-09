---
title: Web Interface
description: User guide for the VaultSandbox Gateway web interface
---

A web application provides a rich user interface for the VaultSandbox Gateway SMTP server. You can view and manage emails, inspect authentication results (SPF, DKIM, DMARC), monitor gateway metrics, and configure inbox settings, all through a simple interface.

![Gateway WebUI Inbox View](/images/gateway/webui/inbox-view.png)

## Features

- **Email Management**: Browse received emails
- **Email Detail View**: Full email rendering with HTML/text views, attachments, and headers
- **Authentication Results**: Visual display of SPF, DKIM, DMARC, and reverse DNS validation
- **Custom Inboxes**: Create and manage multiple virtual inboxes
- **Real-Time Updates**: Server-Sent Events (SSE) for live email notifications
- **Gateway Metrics**: Monitor SMTP server performance and health
- **Dark/Light Theme**: Automatic theme switching based on system preferences
- **Quantum-Safe Decryption**: Support for ML-KEM-768 encrypted email payloads
- **Responsive Design**: Mobile-friendly interface built with PrimeNG and Tailwind CSS

## Tech Stack

- **Framework**: Angular 20.3
- **UI Components**: PrimeNG 20.3 with Material Aura theme
- **Styling**: Tailwind CSS 4.x with PrimeUI plugin
- **State Management**: RxJS observables and signals
- **Security**: DOMPurify for HTML sanitization
- **Cryptography**: @noble/post-quantum for ML-KEM-768 decryption
- **Testing**: Jasmine + Karma

## Accessing the Web Interface

The web interface is automatically served by the Gateway backend at the `/app` endpoint.

### Default URLs

- **HTTP**: `http://localhost:80/app` (or your configured `VSB_SERVER_PORT`)
- **HTTPS**: `https://your-domain.com/app` (if TLS is enabled)

### First Time Access

![API key Input](/images/gateway/webui/api-key-input.png)

1. Navigate to `https://your-domain/app` in your browser
2. You'll be prompted to enter an API key
3. Get your API key from the backend:
   ```bash
   # Retrieve from Docker container
   docker compose exec gateway cat /app/data/.api-key; echo
   ```
4. Enter the API key in the web interface
5. The key is stored in your browser's localStorage for future visits

## API Key Management

The web interface uses **browser localStorage** to persist the API key:

1. **First Launch**: User is prompted to enter API key via form
2. **Validation**: Key is validated against backend's `/api/check-key` endpoint
3. **Storage**: Valid key is stored in `localStorage` with key `vaultsandbox_api_key`
4. **Persistence**: Key is loaded from localStorage on subsequent visits
5. **Automatic Injection**: All API requests include the key via `X-API-Key` header

### Getting Your API Key

```bash
# Backend generates API key on first startup
# Retrieve it from the Docker container:
docker compose exec gateway cat /app/data/.api-key; echo

# Or using Docker CLI:
docker exec vaultsandbox-gateway cat /app/data/.api-key; echo
```

### User Workflow

1. Open web interface at `https://your-domain/app`
2. Enter API key when prompted (one-time setup)
3. Key is stored in browser and used for all subsequent requests
4. No need to re-enter key unless localStorage is cleared

### Troubleshooting API Key Issues

1. **Check API Key**: Verify key matches backend `.api-key` file
2. **Check localStorage**: Open DevTools → Application → Local Storage → Check `vaultsandbox_api_key`
3. **Clear and Re-enter**: Clear localStorage and re-enter the API key
4. **Header Inspection**: Check browser DevTools Network tab for `X-API-Key` header in requests
5. **Backend Validation**: Ensure backend `/api/check-key` endpoint is accessible

## Email Management

### Inbox View

The main inbox interface provides:

- **Email List**: View all received emails with sender, subject, and timestamp
- **Filtering**: Filter by inbox
- **Actions**: Delete inbox and emails

### Email Detail View

![Email View](/images/gateway/webui/email-view.png)

Click any email to view full details:

- **HTML/Text Views**: Toggle between HTML and plain text rendering
- **Headers**: Expandable view of all email headers
- **Attachments**: List of attachments with download support
- **Links**: Extracted links with security warnings for external URLs
- **Authentication Results**: Visual display of SPF, DKIM, DMARC, and reverse DNS

## Email Authentication Display

The web interface provides comprehensive visualization of email authentication:

### SPF (Sender Policy Framework)

- **Pass**: Green checkmark - Sender IP authorized by domain
- **Fail**: Red X - Sender IP not authorized
- **SoftFail**: Yellow warning - Policy suggests rejection but not required
- **Neutral**: Gray dash - No policy statement
- **None**: Gray dash - No SPF record found

### DKIM (DomainKeys Identified Mail)

- **Pass**: Green checkmark - Valid cryptographic signature
- **Fail**: Red X - Invalid or missing signature
- **None**: Gray dash - No DKIM signature present

### DMARC (Domain-based Message Authentication)

- **Pass**: Green checkmark - Alignment checks passed
- **Fail**: Red X - Alignment checks failed
- **None**: Gray dash - No DMARC policy found

### Reverse DNS

- **Pass**: Green checkmark - Valid PTR record for sender IP
- **Fail**: Red X - No PTR record or mismatch

## Custom Inboxes

![Custom Inbox](/images/gateway/webui/custom-inbox.png)

Create and manage multiple virtual inboxes to organize emails:

- **Quick Create**: Click the **"Create Inbox"** button to instantly create an inbox with the last used or default values
- **Custom Configuration**: Click the **cog icon** at the right to access the configuration dialog where you can:
  - **Email Address**: Enter an alias (leave empty for a random email address)
  - **Domain**: Select from available domains (if you have more than one configured)
  - **TTL (Time to Live)**: Set the inbox lifetime in hours (this value will be remembered as your default)

Emails matching the address pattern are automatically routed to the corresponding inbox

### Inbox Management

![Inbox Options](/images/gateway/webui/inbox-options.png)

Right-click on any inbox in the sidebar to access the context menu with the following options:

- **Export Inbox**: Export just the inbox alias and private key
- **Forget Inbox**: Remove the inbox from your local storage (does not delete the inbox, from server)
- **Delete All Emails**: Remove all emails from the inbox while keeping the inbox itself
- **Delete Inbox**: Permanently delete the inbox and all its emails

## Application Menu

![Application Menu](/images/gateway/webui/top-left-menu.png)

Click the menu icon in the top-left corner of the interface to access additional options and tools:

- **Import Inbox**: Import a previously exported inbox
- **Metrics**: Open the metrics dashboard to monitor SMTP server performance, connection statistics
- **Console**: Access the Server-Sent Events (SSE) console for debugging real-time notifications and monitoring event streams
- **Settings**: Configure application preferences
- **Light Mode**: Toggle between light and dark themes
- **Logout**: Clear your API key and log out of the application

## Gateway Metrics

![SSE Console](/images/gateway/webui/metrics.png)

Monitor SMTP server performance and health:

1. Click the **"Metrics"** button in the toolbar
2. View real-time metrics in the **General Metrics** tab:
   - **SMTP Connections**: Current and total connections
   - **Emails Received**: Total emails processed
   - **Uptime**: Server uptime and health status
3. View storage information in the **Storage Metrics** tab:
   - **Memory Usage**: Current email storage space used
   - **Free Space**: Available storage capacity
   - **Cleanup Schedule**: When automatic cleanup occurs

### SSE Console

![SSE Console](/images/gateway/webui/sse-console.png)

For debugging and monitoring SSE events:

1. Click the **"Console"** button in the toolbar
2. View live stream of all SSE events

### Settings

![Settings](/images/gateway/webui/settings.png)

Configure application preferences and security options:

#### HTML Sanitization Level

Choose how HTML email content is sanitized before rendering:

- **Trusted Mode**: No sanitization, but content is rendered in a sandboxed iframe for isolation. Fastest rendering while maintaining basic security boundaries. Only use for trusted sources.
- **Secure Mode - DOMPurify (Recommended)**: Secure HTML sanitization with minimal performance cost. Protects against malicious scripts while preserving legitimate HTML formatting.

#### Display Inline Images in HTML Emails

Toggle to enable or disable rendering of embedded images (cid references) in HTML emails. Disable for additional security and privacy if you're concerned about tracking pixels or external content.

#### Time Format

Choose between 24-hour and 12-hour time display format throughout the application:

- **24-hour (15:30)**: Military/international time format
- **12-hour (3:30 PM)**: Standard AM/PM format

#### Danger Zone

**Delete All Inboxes**: Permanently delete all inboxes and emails from the server. This action cannot be undone and will remove all data immediately.

## Theme Management

The web interface supports automatic theme switching:

- **Light**: Always use light theme
- **Dark**: Always use dark theme

### Changing Theme

1. Click the theme toggle button in the toolbar
2. Select preferred theme
3. Preference is saved to localStorage

## Quantum-Safe Encryption

The web interface supports decryption of quantum-safe encrypted email payloads:

### Encryption Flow (Backend → Frontend)

1. Backend encrypts email using ML-KEM-768 (NIST FIPS 203)
2. Backend signs payload using ML-DSA-65 (NIST FIPS 204)
3. Frontend receives encrypted payload via API
4. Frontend decapsulates shared secret using recipient private key
5. Frontend derives AES-256-GCM key via HKDF-SHA-512
6. Frontend decrypts and verifies email content

### Key Management

- **Development**: Ephemeral keys generated in browser
- **Production**: Private keys loaded from secure storage
- **Key Format**: Raw binary or Base64-encoded

## Security Features

### Input Sanitization

- **DOMPurify**: Sanitizes HTML email content before rendering
- **CSP-safe**: No inline scripts or styles in email content
- **Link Extraction**: External links displayed with security warnings

### API Security

- **API Key Authentication**: All requests authenticated via `X-API-Key` header
- **CORS**: Cross-origin requests handled by backend CORS policy
- **Rate Limiting**: Backend enforces rate limits on API endpoints

### Cryptography

- **Post-Quantum**: ML-KEM-768 for key encapsulation
- **Digital Signatures**: ML-DSA-65 for payload verification
- **AES-256-GCM**: Symmetric encryption with HKDF-SHA-512 key derivation

## Security Considerations

### localStorage API Key Storage

- **Not for Production Auth**: localStorage is accessible via JavaScript (XSS risk)
- **Testing Environments**: Designed for QA/staging where users are trusted
- **Single API Key**: Backend typically has one API key shared by all frontend users
- **No Encryption**: Key stored in plaintext in localStorage
- **HTTPS Recommended**: Always use HTTPS to prevent key interception

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile: iOS Safari, Chrome Android

## Troubleshooting

### Cannot Connect to Backend

1. **Check Backend Status**: Ensure backend is running on expected port
2. **Verify URL**: Check browser console for API endpoint errors
3. **CORS Issues**: Ensure backend allows frontend origin (check `VSB_SERVER_ORIGIN`)

### Email Content Not Rendering

1. **Sanitization**: Check browser console for DOMPurify warnings
2. **CSP**: Verify Content Security Policy allows email content
3. **Format**: Ensure backend returns valid email structure

### Theme Not Switching

1. **Service Initialization**: Check browser console for service errors
2. **LocalStorage**: Verify browser allows localStorage access
3. **Theme Files**: Ensure theme CSS files are loaded (check Network tab)

### Real-Time Updates Not Working

1. **SSE Connection**: Check SSE Console for connection status
2. **Backend SSE**: Verify backend has `VSB_SSE_CONSOLE_ENABLED=true`
3. **Network**: Check for proxy/firewall blocking SSE connections
