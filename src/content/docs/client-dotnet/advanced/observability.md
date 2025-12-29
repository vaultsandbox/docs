---
title: Observability
description: OpenTelemetry integration for distributed tracing and metrics in VaultSandbox Client for .NET
---

VaultSandbox Client includes built-in OpenTelemetry support for distributed tracing and metrics collection. This enables deep observability into your email testing operations, making it easier to debug issues, monitor performance, and integrate with your existing observability stack.

## Overview

The SDK exposes telemetry through the `VaultSandboxTelemetry` static class:

- **ActivitySource**: For distributed tracing (spans)
- **Meter**: For metrics (counters and histograms)

## Quick Start

### Install OpenTelemetry Packages

```bash
dotnet add package OpenTelemetry
dotnet add package OpenTelemetry.Exporter.Console
dotnet add package OpenTelemetry.Exporter.OpenTelemetryProtocol
```

### Basic Configuration

```csharp
using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;
using VaultSandbox.Client;

// Configure tracing
using var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .AddSource(VaultSandboxTelemetry.ActivitySource.Name)
    .AddConsoleExporter()
    .Build();

// Configure metrics
using var meterProvider = Sdk.CreateMeterProviderBuilder()
    .AddMeter(VaultSandboxTelemetry.Meter.Name)
    .AddConsoleExporter()
    .Build();

// Use the client as normal
var client = VaultSandboxClientBuilder.Create()
    .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
    .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
    .Build();

var inbox = await client.CreateInboxAsync();
// Telemetry is automatically collected
```

## VaultSandboxTelemetry Class

```csharp
public static class VaultSandboxTelemetry
{
    public const string ServiceName = "VaultSandbox.Client";
    public static readonly string ServiceVersion;
    public static readonly ActivitySource ActivitySource;
    public static readonly Meter Meter;
}
```

| Member | Type | Description |
|--------|------|-------------|
| `ServiceName` | `string` | Constant service name: `"VaultSandbox.Client"` |
| `ServiceVersion` | `string` | Assembly version for telemetry |
| `ActivitySource` | `ActivitySource` | Source for distributed tracing activities/spans |
| `Meter` | `Meter` | Meter for metrics collection |

## Distributed Tracing

The SDK creates spans for key operations, allowing you to trace the flow of email testing across your system.

### Activity Source

```csharp
using System.Diagnostics;
using VaultSandbox.Client;

// Register the activity source with your tracer provider
var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .AddSource(VaultSandboxTelemetry.ActivitySource.Name)
    .AddOtlpExporter(options =>
    {
        options.Endpoint = new Uri("http://localhost:4317");
    })
    .Build();
```

### Traced Operations

The following operations create spans:

- `CreateInboxAsync` - Inbox creation
- `DeleteInboxAsync` - Inbox deletion
- `GetEmailsAsync` - Email listing
- `GetEmailAsync` - Single email retrieval
- `GetEmailRawAsync` - Raw email retrieval
- `WaitForEmailAsync` - Email waiting
- `WaitForEmailCountAsync` - Email count waiting
- `WatchAsync` - Real-time monitoring
- `ExportAsync` / `ImportInboxAsync` - Import/export operations

### Span Attributes

Spans include relevant attributes:

| Attribute | Description |
|-----------|-------------|
| `vaultsandbox.inbox.address` | Email address of the inbox |
| `vaultsandbox.inbox.hash` | Unique inbox identifier |
| `vaultsandbox.email.id` | Email identifier (when applicable) |
| `vaultsandbox.email.count` | Number of emails (when applicable) |
| `vaultsandbox.operation` | Operation name |

### Example Trace Output

```
Activity.TraceId:    abc123def456
Activity.SpanId:     789xyz
Activity.DisplayName: CreateInbox
Activity.Kind:       Client
Activity.StartTime:  2024-01-15T10:30:00.000Z
Activity.Duration:   00:00:00.150
Activity.Tags:
    vaultsandbox.inbox.address: test123@inbox.vaultsandbox.com
    vaultsandbox.inbox.hash: abc123
    vaultsandbox.operation: CreateInbox
```

## Metrics

The SDK collects metrics for monitoring email testing performance and usage.

### Counters

Track the count of specific events:

| Metric Name | Description | Unit |
|-------------|-------------|------|
| `vaultsandbox.inboxes.created` | Number of inboxes created | `{inbox}` |
| `vaultsandbox.inboxes.deleted` | Number of inboxes deleted | `{inbox}` |
| `vaultsandbox.emails.received` | Number of emails received | `{email}` |
| `vaultsandbox.emails.deleted` | Number of emails deleted | `{email}` |
| `vaultsandbox.api.calls` | Total API calls made | `{call}` |
| `vaultsandbox.api.errors` | Total API errors encountered | `{error}` |

### Histograms

Track distributions of durations:

| Metric Name | Description | Unit |
|-------------|-------------|------|
| `vaultsandbox.email.wait.duration` | Time spent waiting for emails | `ms` |
| `vaultsandbox.decryption.duration` | Time spent decrypting emails | `ms` |
| `vaultsandbox.api.call.duration` | Duration of API calls | `ms` |

### Metrics Configuration

```csharp
using OpenTelemetry;
using OpenTelemetry.Metrics;
using VaultSandbox.Client;

var meterProvider = Sdk.CreateMeterProviderBuilder()
    .AddMeter(VaultSandboxTelemetry.Meter.Name)
    .AddOtlpExporter(options =>
    {
        options.Endpoint = new Uri("http://localhost:4317");
    })
    .Build();
```

### Example Metrics Output

```
Metric: vaultsandbox.inboxes.created
  Value: 5

Metric: vaultsandbox.emails.received
  Value: 12

Metric: vaultsandbox.email.wait.duration
  Histogram:
    Count: 10
    Sum: 15234 ms
    Min: 102 ms
    Max: 5201 ms

Metric: vaultsandbox.api.call.duration
  Histogram:
    Count: 47
    Sum: 8923 ms
    Min: 45 ms
    Max: 892 ms
```

## Integration Examples

### ASP.NET Core

```csharp
// Program.cs
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;
using VaultSandbox.Client;

var builder = WebApplication.CreateBuilder(args);

// Add OpenTelemetry tracing
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing =>
    {
        tracing
            .AddSource(VaultSandboxTelemetry.ActivitySource.Name)
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddOtlpExporter();
    })
    .WithMetrics(metrics =>
    {
        metrics
            .AddMeter(VaultSandboxTelemetry.Meter.Name)
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddOtlpExporter();
    });

// Add VaultSandbox client
builder.Services.AddVaultSandboxClient(options =>
{
    options.BaseUrl = builder.Configuration["VaultSandbox:BaseUrl"]!;
    options.ApiKey = builder.Configuration["VaultSandbox:ApiKey"]!;
});

var app = builder.Build();
```

### xUnit Test Project

```csharp
// TestFixture.cs
using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;
using VaultSandbox.Client;
using Xunit;

public class TelemetryFixture : IDisposable
{
    public TracerProvider TracerProvider { get; }
    public MeterProvider MeterProvider { get; }

    public TelemetryFixture()
    {
        TracerProvider = Sdk.CreateTracerProviderBuilder()
            .AddSource(VaultSandboxTelemetry.ActivitySource.Name)
            .AddConsoleExporter()
            .Build();

        MeterProvider = Sdk.CreateMeterProviderBuilder()
            .AddMeter(VaultSandboxTelemetry.Meter.Name)
            .AddConsoleExporter()
            .Build();
    }

    public void Dispose()
    {
        TracerProvider.Dispose();
        MeterProvider.Dispose();
    }
}

[CollectionDefinition("Telemetry")]
public class TelemetryCollection : ICollectionFixture<TelemetryFixture> { }

[Collection("Telemetry")]
public class EmailTests
{
    [Fact]
    public async Task Should_Trace_Email_Operations()
    {
        var client = VaultSandboxClientBuilder.Create()
            .WithBaseUrl(Environment.GetEnvironmentVariable("VAULTSANDBOX_URL")!)
            .WithApiKey(Environment.GetEnvironmentVariable("VAULTSANDBOX_API_KEY")!)
            .Build();

        var inbox = await client.CreateInboxAsync();
        // Operations are automatically traced

        await client.DeleteInboxAsync(inbox.EmailAddress);
    }
}
```

### Jaeger Integration

```csharp
using OpenTelemetry;
using OpenTelemetry.Exporter;
using OpenTelemetry.Trace;
using VaultSandbox.Client;

var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .AddSource(VaultSandboxTelemetry.ActivitySource.Name)
    .AddJaegerExporter(options =>
    {
        options.AgentHost = "localhost";
        options.AgentPort = 6831;
    })
    .Build();
```

### Prometheus Integration

```csharp
using OpenTelemetry;
using OpenTelemetry.Metrics;
using VaultSandbox.Client;

var meterProvider = Sdk.CreateMeterProviderBuilder()
    .AddMeter(VaultSandboxTelemetry.Meter.Name)
    .AddPrometheusExporter()
    .Build();
```

### Grafana/Tempo Integration

```csharp
using OpenTelemetry;
using OpenTelemetry.Trace;
using VaultSandbox.Client;

var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .AddSource(VaultSandboxTelemetry.ActivitySource.Name)
    .AddOtlpExporter(options =>
    {
        options.Endpoint = new Uri("http://tempo:4317");
        options.Protocol = OtlpExportProtocol.Grpc;
    })
    .Build();
```

## Custom Spans

You can create custom spans that integrate with VaultSandbox telemetry:

```csharp
using System.Diagnostics;
using VaultSandbox.Client;

public class EmailTestService
{
    private readonly IVaultSandboxClient _client;

    public EmailTestService(IVaultSandboxClient client)
    {
        _client = client;
    }

    public async Task<bool> TestEmailFlowAsync(string scenario)
    {
        using var activity = VaultSandboxTelemetry.ActivitySource.StartActivity(
            "TestEmailFlow",
            ActivityKind.Internal);

        activity?.SetTag("test.scenario", scenario);

        try
        {
            var inbox = await _client.CreateInboxAsync();
            activity?.SetTag("vaultsandbox.inbox.address", inbox.EmailAddress);

            // Trigger email
            await TriggerTestEmailAsync(inbox.EmailAddress);

            // Wait for email
            var email = await inbox.WaitForEmailAsync(new WaitForEmailOptions
            {
                Timeout = TimeSpan.FromSeconds(30)
            });

            activity?.SetTag("test.result", "success");
            activity?.SetStatus(ActivityStatusCode.Ok);

            await _client.DeleteInboxAsync(inbox.EmailAddress);
            return true;
        }
        catch (Exception ex)
        {
            activity?.SetTag("test.result", "failure");
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.RecordException(ex);
            throw;
        }
    }
}
```

## Best Practices

### 1. Configure Sampling in Production

```csharp
var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .AddSource(VaultSandboxTelemetry.ActivitySource.Name)
    .SetSampler(new TraceIdRatioBasedSampler(0.1)) // Sample 10% of traces
    .AddOtlpExporter()
    .Build();
```

### 2. Add Service Information

```csharp
using OpenTelemetry.Resources;

var tracerProvider = Sdk.CreateTracerProviderBuilder()
    .AddSource(VaultSandboxTelemetry.ActivitySource.Name)
    .SetResourceBuilder(ResourceBuilder.CreateDefault()
        .AddService("my-test-service", serviceVersion: "1.0.0")
        .AddAttributes(new Dictionary<string, object>
        {
            ["environment"] = "staging",
            ["team"] = "qa"
        }))
    .AddOtlpExporter()
    .Build();
```

### 3. Use Baggage for Context Propagation

```csharp
using System.Diagnostics;

// Set baggage at the start of a test
Baggage.SetBaggage("test.id", Guid.NewGuid().ToString());
Baggage.SetBaggage("test.name", "WelcomeEmailTest");

// Baggage is automatically propagated to child spans
var inbox = await client.CreateInboxAsync();
```

### 4. Monitor Key Metrics

Set up alerts on these metrics:

- `vaultsandbox.api.errors` - Alert on error rate spikes
- `vaultsandbox.email.wait.duration` - Alert on slow email delivery
- `vaultsandbox.api.call.duration` - Monitor API latency

### 5. Correlate with Application Traces

```csharp
public async Task ProcessUserRegistrationAsync(string email)
{
    using var activity = Activity.Current?.Source.StartActivity("ProcessUserRegistration");

    // Your application creates a user...
    var user = await CreateUserAsync(email);

    // VaultSandbox spans will be children of this activity
    var inbox = await _client.CreateInboxAsync();

    await SendWelcomeEmailAsync(user.Email);

    var welcomeEmail = await inbox.WaitForEmailAsync(new WaitForEmailOptions
    {
        Timeout = TimeSpan.FromSeconds(30),
        Subject = "Welcome"
    });

    // Verify email content...
}
```

## Troubleshooting

### No Traces Appearing

1. Verify the ActivitySource is registered:
```csharp
.AddSource(VaultSandboxTelemetry.ActivitySource.Name)
```

2. Check exporter configuration
3. Verify network connectivity to collector

### No Metrics Appearing

1. Verify the Meter is registered:
```csharp
.AddMeter(VaultSandboxTelemetry.Meter.Name)
```

2. Ensure metrics are being collected (some exporters require explicit flushing)

### High Cardinality Warnings

If you see warnings about high cardinality, consider filtering attributes:

```csharp
var meterProvider = Sdk.CreateMeterProviderBuilder()
    .AddMeter(VaultSandboxTelemetry.Meter.Name)
    .AddView(
        instrumentName: "vaultsandbox.api.call.duration",
        new ExplicitBucketHistogramConfiguration
        {
            Boundaries = new double[] { 50, 100, 200, 500, 1000, 2000, 5000 }
        })
    .AddOtlpExporter()
    .Build();
```

## Next Steps

- [Delivery Strategies](/client-dotnet/advanced/strategies) - SSE vs Polling configuration
- [Error Handling](/client-dotnet/api/errors) - Handle and trace errors
- [Configuration Reference](/client-dotnet/configuration) - All configuration options
