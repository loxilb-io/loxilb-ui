# Encrypted authentication database recovery package

This operator tool supplements a Gateway configuration snapshot. It is not an
OAM HTTP endpoint and does not give the UI's configuration role database access.

Requirements: Python 3, `cryptography`, Docker CLI access, an owned running
PostgreSQL container, and a database custodian who can read both authentication
schemas and `pg_control_system()`. PostgreSQL major versions must match between
export and restore; qualify the actual Gateway and PostgreSQL versions before use.

Run `python3 scripts/recovery/snapshot_db_package.py --help` for commands.

- `keygen`: creates a new owner-only 32-byte AES key; never overwrites a file.
- `export`: captures `aigw` and `aigw_mgmt` through `pg_dump -Fc`, excludes the
  management `token` table, and encrypts the dump and supplied Gateway JSON
  together with AES-256-GCM. Unknown management tables fail closed so a future
  session store cannot silently enter the package. Configuration writers must
  be controlled separately: the two captures are not atomic.
- `inspect`: authenticates/decrypts and prints a small, non-secret summary.
- `extract-snapshot`: authenticates/decrypts the package and writes its Gateway
  snapshot to a new owner-only file. Existing files are never overwritten. This
  command does not apply the snapshot or connect a service.
- `restore`: requires a different PostgreSQL cluster of the same major, an
  ownership label, exclusively internal Docker networks, no published ports,
  and a new database named `recovery_[a-z0-9_]{1,40}`. It refuses an existing
  database, revokes PUBLIC CONNECT, restores without roles/ACLs, and disables
  **all** restored API keys. It never restores management sessions, provisions
  application roles, changes a Gateway connection, enables credentials, or
  performs a cutover. Failed new databases are preserved for diagnosis.

The encryption key must be owned by the current user, have no group/other
permissions, and not be a symlink. Keep it separately from the package. Loss of
the key prevents recovery. Package and key outputs use exclusive creation and
mode 0600. Database errors are not printed because they may contain hashes.

The package contains password/API-key hashes and policy data. Treat it as a
credential backup even when encrypted. It cannot reconstruct a raw API key.
PEM/private keys, node secrets, OAM database/vault/JWT keys, host configuration,
licenses, and client secret custody remain separate dependencies.

Before connecting a recovered service, a custodian must review current user
roles/password changes, revocations, expirations, and key policies. Provision
only the destination's schema-specific roles/ownership and selected CONNECT
permissions. Do not blindly re-enable old keys. A backup does not contain later
revocation history. Never point the production Gateway at the qualification DB.

Validation: `python3 scripts/recovery/test_snapshot_db_package.py`. Tests cover
package authentication, ciphertext tampering, exclusive extraction/output,
key permissions, destination guards, and unknown management table rejection.
Configuration and database captures remain separate; verify restored settings,
external dependencies, authorization and workload behavior in isolation before
any separately authorized service cutover.
