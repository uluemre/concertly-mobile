# Flyway migrations

The database that predates Flyway is intentionally not recreated by this
project. To adopt an existing Concertly database safely, first back it up and
run the application once with these environment variables:

```text
FLYWAY_ENABLED=true
FLYWAY_BASELINE_ON_MIGRATE=true
FLYWAY_BASELINE_VERSION=1
DDL_AUTO=validate
```

Flyway records the existing schema as version 1 without executing destructive
DDL. Every later schema change must be an ordered SQL file in this directory,
for example `V2__add_event_indexes.sql`. New production databases must be
provisioned from a reviewed versioned baseline before using `DDL_AUTO=validate`.
