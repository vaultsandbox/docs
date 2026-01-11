# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.1] - 2026-01-11

### Changed

- Removed auto strategy from client SDK documentation
- Updated VSB CLI docs for strategy configuration

### Added

- `VSB_LOCAL_ALLOW_CLEAR_ALL_INBOXES` environment variable documentation

## [0.6.0] - 2026-01-04

### Changed

- Updated client SDK documentation to match v0.6.0 releases (Go, Java, Node, Python, .NET)
- Updated version references in `src/data/versions.ts`

### Added

- Cryptographic protocol specification documentation

## [0.5.4] - 2026-01-01

### Changed

- Updated client SDK documentation across all languages (Go, Java, Node, Python, .NET)
- Converted select documentation files to MDX format
- Added centralized version management via `src/data/versions.ts`

## [0.5.3] - 2025-12-19

### Added

- .Net Documentation

## [0.5.2] - 2025-12-19

### Added

- Hardened Images documentation - security-hardened Docker images with no shell access
- Guide for API key configuration via environment variables for hardened deployments
- Docker logging and health monitoring documentation for shell-less containers
- Python Docs

## [0.5.1] - 2025-12-14

### Added

- VSX DNS documentation - zero-config setup with automatic domain assignment via vsx.email
- New Quick Start guide for VSX DNS (1 environment variable)
- Quick Start - Custom Domain guide for users needing their own domain

### Changed

- Simplified custom domain setup from 3 to 2 environment variables (`VSB_CERT_EMAIL` now optional)
- Updated Docker Compose guide with both VSX DNS and Custom Domain options
- Updated Deployment Setup guide with VSX DNS callouts and split checklists
- Gateway Configuration reference now includes VSX DNS mode documentation

## [0.5.0] - 2025-12-09

### Added

- Initial documentation site using Astro and Starlight
- Getting started guides for VaultSandbox Gateway
- Deployment documentation (Docker, Coolify, Kubernetes)
- Gateway configuration reference
- Node.js client SDK documentation
- SDK development guides
- Contributing guidelines
- Code of Conduct (Contributor Covenant v2.1)
- Security policy
