---
title: Installation
description: Installing the VaultSandbox Java SDK in your project
---

This guide covers installing the VaultSandbox Java SDK and verifying your setup.

## Requirements

- **Java 21 or later** - Required for ML-KEM-768 cryptography support
- **Gradle 8.x** or **Maven 3.x** - Build tool
- **Network access** - To Maven Central for dependencies

## Add the Dependency

import { Tabs, TabItem } from '@astrojs/starlight/components';

<Tabs>
  <TabItem label="Gradle (Groovy)">
```groovy
dependencies {
    implementation 'com.vaultsandbox:client:0.5.0'
}
```
  </TabItem>
  <TabItem label="Gradle (Kotlin)">
```kotlin
dependencies {
    implementation("com.vaultsandbox:client:0.5.0")
}
```
  </TabItem>
  <TabItem label="Maven">
```xml
<dependency>
    <groupId>com.vaultsandbox</groupId>
    <artifactId>client</artifactId>
    <version>0.5.0</version>
</dependency>
```
  </TabItem>
</Tabs>

## Test Dependency

If you only need the SDK for testing, add it as a test dependency:

<Tabs>
  <TabItem label="Gradle (Groovy)">
```groovy
dependencies {
    testImplementation 'com.vaultsandbox:client:0.5.0'
}
```
  </TabItem>
  <TabItem label="Gradle (Kotlin)">
```kotlin
dependencies {
    testImplementation("com.vaultsandbox:client:0.5.0")
}
```
  </TabItem>
  <TabItem label="Maven">
```xml
<dependency>
    <groupId>com.vaultsandbox</groupId>
    <artifactId>client</artifactId>
    <version>0.5.0</version>
    <scope>test</scope>
</dependency>
```
  </TabItem>
</Tabs>

## Transitive Dependencies

The SDK includes these dependencies automatically:

| Dependency | Version | Purpose |
|------------|---------|---------|
| Bouncy Castle | 1.79 | ML-KEM-768 post-quantum cryptography |
| OkHttp | 4.12.0 | HTTP client and SSE support |
| Gson | 2.11.0 | JSON serialization |
| SLF4J API | 2.0.16 | Logging facade |

The SDK automatically registers the Bouncy Castle security provider - no manual setup required.

## SLF4J Logging Binding

The SDK uses SLF4J for logging. Add a logging implementation to see logs:

<Tabs>
  <TabItem label="Logback">
```groovy
// Gradle
testRuntimeOnly 'ch.qos.logback:logback-classic:1.5.12'
```
```xml
<!-- Maven -->
<dependency>
    <groupId>ch.qos.logback</groupId>
    <artifactId>logback-classic</artifactId>
    <version>1.5.12</version>
    <scope>test</scope>
</dependency>
```
  </TabItem>
  <TabItem label="Log4j2">
```groovy
// Gradle
testRuntimeOnly 'org.apache.logging.log4j:log4j-slf4j2-impl:2.24.0'
```
```xml
<!-- Maven -->
<dependency>
    <groupId>org.apache.logging.log4j</groupId>
    <artifactId>log4j-slf4j2-impl</artifactId>
    <version>2.24.0</version>
    <scope>test</scope>
</dependency>
```
  </TabItem>
</Tabs>

## Verify Installation

Create a simple test to verify the SDK is correctly installed:

```java
import com.vaultsandbox.client.VaultSandboxClient;

public class VerifyInstallation {
    public static void main(String[] args) {
        try (VaultSandboxClient client = VaultSandboxClient.create("test-key")) {
            System.out.println("VaultSandbox client initialized successfully!");
            System.out.println("Bouncy Castle provider registered.");
        }
    }
}
```

Run it:

```bash
# Gradle
./gradlew run

# Maven
mvn compile exec:java -Dexec.mainClass="VerifyInstallation"
```

If the output shows the success message, the SDK is correctly installed.

## IDE Setup

### IntelliJ IDEA

1. Open your project (Gradle/Maven auto-detected)
2. Wait for dependency sync to complete
3. SDK classes will be available with auto-import

### Eclipse

1. **File → Import → Gradle/Maven → Existing Project**
2. Select your project directory
3. Finish import and wait for build

### VS Code

1. Install the **Extension Pack for Java**
2. Open the project folder
3. Java extension auto-detects Gradle/Maven

## Platform Compatibility

| Platform | Supported |
|----------|-----------|
| Linux | Yes |
| macOS | Yes |
| Windows | Yes |
| Android | No (different crypto requirements) |

The SDK is designed for server-side JVM applications and testing frameworks.

## Troubleshooting

### Java Version Error

```
error: class file has wrong version 65.0, should be 61.0
```

Your Java version is too old. Check your version:

```bash
java -version
```

Ensure `JAVA_HOME` points to Java 21+:

```bash
export JAVA_HOME=/path/to/java21
```

### Missing Bouncy Castle

```
java.security.NoSuchAlgorithmException: ML-KEM not available
```

The Bouncy Castle dependency may not be resolved. Check your dependency tree:

```bash
# Gradle
./gradlew dependencies --configuration runtimeClasspath | grep bouncy

# Maven
mvn dependency:tree | grep bouncy
```

### Network/Proxy Issues

If dependencies fail to download, check:
- Network connectivity to Maven Central
- Corporate proxy settings in `~/.gradle/gradle.properties` or `~/.m2/settings.xml`

```properties
# gradle.properties
systemProp.http.proxyHost=proxy.example.com
systemProp.http.proxyPort=8080
```

### SLF4J Warning

```
SLF4J: No SLF4J providers were found.
```

This is a warning, not an error. Add a logging binding (Logback or Log4j2) to enable logs.

## Next Steps

- [Configuration](/client-java/configuration/) - Configure the client
- [Managing Inboxes](/client-java/guides/managing-inboxes/) - Create test inboxes
- [Quick Start](/client-java/#quick-example) - See a complete example
