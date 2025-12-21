---
title: .NET Client
description: Overview of the VaultSandbox .NET SDK for email testing
---

The official .NET SDK for VaultSandbox Gateway. It handles quantum-safe encryption automatically, letting you focus on testing email workflows.

## Key Capabilities

- **Automatic Encryption**: ML-KEM-768 key encapsulation + AES-256-GCM encryption handled transparently
- **Real-Time Delivery**: SSE-based email delivery with smart polling fallback
- **Email Authentication**: Built-in SPF/DKIM/DMARC validation helpers
- **Full Email Access**: Decrypted content, headers, links, and attachments
- **Dependency Injection**: First-class ASP.NET Core `IServiceCollection` integration

## Requirements

- .NET 9.0+ (not supported in Blazor WebAssembly or browser runtimes)
- VaultSandbox Gateway server
- Valid API key

## Gateway Server

The SDK connects to a VaultSandbox Gateway - a receive-only SMTP server you self-host. It handles email reception, authentication validation, and encryption. You can run one with Docker in minutes.

See [Gateway Overview](/gateway/) or jump to [Quick Start](/getting-started/quickstart/) to deploy one.

## Quick Example

```csharp
using VaultSandbox.Client;

var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl("https://gateway.example.com")
    .WithApiKey("your-api-key")
    .Build();

// Create inbox (keypair generated automatically)
var inbox = await client.CreateInboxAsync();

// Send email to inbox.EmailAddress from your application...

// Wait for email
var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
{
    Timeout = TimeSpan.FromSeconds(30)
});

Console.WriteLine($"Subject: {email.Subject}");
Console.WriteLine($"Text: {email.Text}");

// Cleanup
await client.DeleteInboxAsync(inbox.EmailAddress);
await client.DisposeAsync();
```

## Links

- [GitHub Repository](https://github.com/vaultsandbox/client-dotnet)
- [NuGet Package](https://www.nuget.org/packages/VaultSandbox.Client)

## Next Steps

- [Installation](/client-dotnet/installation/) - Install the SDK
- [Configuration](/client-dotnet/configuration/) - Client options and setup
- [Core Concepts](/client-dotnet/concepts/inboxes/) - Inboxes, emails, and authentication
- [API Reference](/client-dotnet/api/client/) - Full API documentation
