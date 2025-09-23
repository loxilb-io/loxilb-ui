# Secure Admin Setup - API Specification (Updated)

## Overview
This spec reflects the implemented Secure Admin Setup flow described in `SECURE_ADMIN_SETUP_IMPLEMENTATION_PLAN.md`. It preserves the existing trial admin auto-creation and adds a secure, first-login credential update with tracking flags.

Key database changes are implemented in `database/init/00-init-complete.sql` and propagated to Kubernetes ConfigMaps.

## Endpoints

### 1) Get Setup Status
```
GET /oam/setup/status
```
Returns whether the default admin credentials must be updated and basic system info.

Response:
```json
{
  "needsCredentialUpdate": true,
  "adminExists": true,
  "hasDefaultCredentials": true,
  "credentialsUpdated": false,
  "systemInfo": {
    "version": "string",
    "installationId": "string",
    "adminUserId": 1
  }
}
```

Notes:
- `needsCredentialUpdate` is true when the admin user still has default credentials or `must_change_password` is true.
- `installationId` is read from `system_settings(setting_key='installation_id')`.

### 2) Update Admin Credentials
```
POST /oam/setup/update-admin
```
Allows updating from default to user-provided credentials. No auth required for the very first update. Subsequent changes should use the normal authenticated flow.

Request:
```json
{
  "currentUsername": "admin",
  "currentPassword": "AdminNetlox132!",
  "newUsername": "string",
  "newPassword": "string",
  "newEmail": "string",
  "confirmPassword": "string"
}
```

Validation rules:
- Current credentials must match the existing admin user.
- `newUsername`: 3-50 chars, alphanumeric + underscore.
- `newPassword`: meet existing password policy (>= 9 chars, complexity enforced by server).
- `newEmail`: valid email format.
- `newPassword` must equal `confirmPassword`.

Response (success):
```json
{
  "success": true,
  "message": "Admin credentials updated successfully",
  "newAccessToken": "string"
}
```

Response (error examples):
```json
{ "success": false, "message": "Invalid current credentials" }
{ "success": false, "message": "Password does not meet policy" }
{ "success": false, "message": "Username already taken" }
```

Side effects on success:
- Update `users.username`, `users.password`, `users.email`.
- Set `users.credentials_updated = TRUE` and `users.credentials_updated_at = NOW()`.
- Set `users.must_change_password = FALSE` (it is created/initialized as TRUE).
- Optionally update `system_config('admin_credentials_updated') = 'true'`.

## Database Schema Summary

Implemented in `database/init/00-init-complete.sql`:

```sql
-- users (excerpt)
CREATE TABLE IF NOT EXISTS users (
  ...,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  credentials_updated BOOLEAN DEFAULT FALSE COMMENT 'True if user has updated from default credentials',
  credentials_updated_at TIMESTAMP NULL COMMENT 'When credentials were last updated',
  must_change_password BOOLEAN DEFAULT TRUE COMMENT 'True if user must change password on next login'
);

-- system_config for global flags
CREATE TABLE IF NOT EXISTS system_config (
  config_key VARCHAR(50) PRIMARY KEY,
  config_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed values (idempotent)
INSERT INTO system_config (config_key, config_value) VALUES
('admin_credentials_updated', 'false'),
('admin_setup_version', '1.0')
ON DUPLICATE KEY UPDATE config_value = config_value;

-- Helpful indexes
CALL CreateIndexIfNotExists('users', 'idx_users_credentials_updated', 'credentials_updated');
CALL CreateIndexIfNotExists('users', 'idx_users_username_credentials', 'username, credentials_updated');
```

## Implementation Notes

- `GET /oam/setup/status` and `POST /oam/setup/update-admin` are handled by minimal setup handlers (see `internal/handlers/setup_handler.go`, per plan) and wired in `internal/routes/routes.go`.
- Business logic is implemented in `internal/services/user_service.go` methods described in the plan:
  - `GetAdminCredentialStatus()`
  - `UpdateAdminCredentials(...)`
  - `HasDefaultCredentials(userID)`
  - `MarkCredentialsUpdated(userID)`
  - `CheckDefaultAdminCredentials()`
- Default admin continues to be auto-created for trial flow; the first login requires updating credentials due to `must_change_password = TRUE`.

## Security

- Verify current credentials before update; add rate-limiting for repeated failures.
- Enforce existing password policy and prevent using the default password again.
- Audit log successful and failed update attempts via existing logging.