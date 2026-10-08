# barber-saas-notifications-db

> notifications bounded context: database (schema, seeds, migrations)

Part of the **Barber Saas** distributed system — team `barber-saas`, Grupo 2.
Governance and documentation live in [`barber-saas-docs`](https://github.com/code-corhuila/barber-saas-docs).

## Branching

Three permanent branches. **None of them accepts a direct commit** — you enter through a child
branch and leave through a Pull Request.

```
develop  <--PR--  feat/... fix/... chore/...
qa       <--PR--  qa/...
main     <--PR--  release/...  hotfix/...
```

Promotion happens **by re-application** (`git cherry-pick -x`), never by merging one permanent
branch into another: `merge develop -> qa` and `merge qa -> main` do not exist in this model.

`main` requires **1 approval from `ariel5253`**. On `develop` and `qa` the team sets its own review
rule.

Full policy: `00-governance/branching-policy.md` in `barber-saas-docs`.

---

## BarberSaaS — what this repository is

The `notifications` database in MongoDB (ADR-011): the collections `notification`, `device_token`,
`idempotency_key` and `processed_event`, versioned with Liquibase and its MongoDB extension (ADR-007), following the
`db-mongo` template with the Annex J corrections: it has **no database instance of its own**. Its
runner applies the changesets to the single MongoDB instance of `barber-saas-infra-mongo`, with its
own changelog collections (`databasechangelog_notifications`). Model: `06-data/models.md` §7 and
§10 in `barber-saas-docs`.

```
changelog/changelog-master.yaml
01_ddl/  00_collections   createCollection with a strict $jsonSchema validator
         01_validators    a later change of a validator goes here, with collMod
         02_indexes       the inbox index and the unique indexes
03_dcl/  00_roles         notifications_reader, notifications_writer
         01_grants        notifications_writer to notifications_app
```

Every changeset declares its rollback inline (`dropCollection`, `dropIndex`, `dropRole`).

### What the structure guarantees

| Rule | How |
|---|---|
| A redelivered event never notifies twice (ADR-016) | `uq_notification_source_event`, unique and partial on `sourceEventId` |
| A redelivered password reset never e-mails twice (`DEC-NOTIF-01`) | `processed_event`: the event id is its `_id`; it keeps only the id, type and time, never the code |
| A device token belongs to one user | `uq_device_token_token`, unique on `token` |
| One record per Idempotency-Key and operation (norm 5.3.8) | `uq_idempotency_key` on `{key, operation}` |
| Only the fields of the model, with their limits | `$jsonSchema` with `additionalProperties: false`, `validationLevel: strict`, `validationAction: error` |
| The inbox of a user, most recent first | `idx_notification_user_read` on `{userId, read, createdAt: -1}` |

### How to run the migrations

From `barber-saas-infra-postgres`, with the platform up (`./scripts/migrate.sh dev` runs every runner):

```bash
docker compose --env-file env/dev.env --profile tooling run --rm notifications-db-migrate            # update
docker compose --env-file env/dev.env --profile tooling run --rm notifications-db-migrate status --verbose
docker compose --env-file env/dev.env --profile tooling run --rm notifications-db-migrate rollback-count 1
```

The runner signs in as the instance administrator (`MONGO_ADMIN_USER`); the service never does:
it connects as `notifications_app`, which `barber-saas-infra-mongo` creates in the `notifications`
database and this repository grants `notifications_writer`.

### How it is tested

`.github/workflows/db-ci.yml` starts a single-node replica set, creates `notifications_app` as the
infrastructure does, builds the collections from an empty instance, checks that a second update
applies nothing, rolls everything back and applies it again. Then `tests/structure.js` checks that
the validators and the unique indexes refuse what they must (a second notification of the same
event, an unknown type, an extra field, a repeated device token or key).

### Never edit an applied changeset

Liquibase keeps a checksum of each applied changeset; editing one, even a comment, stops every
existing database from migrating. A change is always a new changeset (a validator with `collMod`
in `01_validators`).
