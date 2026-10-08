# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-10-08

User stories: code-corhuila/barber-saas-docs#5, code-corhuila/barber-saas-docs#6, code-corhuila/barber-saas-docs#59

### Added

- **ddl:** create the notification, device_token and idempotency_key collections
- **ddl:** add the inbox index and the unique indexes
- **dcl:** add the reader and writer roles and grant the writer to notifications_app
- **deploy:** add the notifications-db-migrate runner
- **ddl:** add the processed_event collection
- **ddl:** expire processed events after 30 days

### Fixed

- **ddl:** accept only the e-mailed event types in processed_event

### Documentation

- **readme:** point the header to Barber Saas and barber-saas-docs
- **readme:** explain the collections, their guarantees and how to migrate

### Tests

- **db:** specify what the collections and indexes must refuse
- **structure:** check that processed_event refuses duplicates and payloads
- **structure:** check the required fields, types and TTL of processed_event

### Maintenance

- add the ignore rules, the environment names and the pull request template

[2.0.0]: https://github.com/code-corhuila/barber-saas-notifications-db/releases/tag/v2.0.0
