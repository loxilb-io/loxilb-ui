# Secure Admin Setup - Simple API Flow (Updated)

## Overview
Minimal, secure flow for first-time admin credential update while preserving existing auto-created trial admin. Uses the new endpoints documented in `API_SPEC.md`.

## Main Flow: User Opens App

```
1. User opens loxilb-ui
   ↓
2. Frontend: GET /oam/setup/status
   ↓
3. If needsCredentialUpdate = true → Redirect to /setup (force update)
   ↓
4. User submits new admin credentials (username/email/password)
   ↓
5. Frontend: POST /oam/setup/update-admin
   ↓
6. On success → redirect to /login
```

## API Calls (Only 2!)

### 1. Check Setup
```typescript
type SetupStatus = {
  needsCredentialUpdate: boolean;
  adminExists: boolean;
  hasDefaultCredentials: boolean;
  credentialsUpdated: boolean;
};

const needsSetup = async (): Promise<boolean> => {
  const response = await GET_OAM('/oam/setup/status');
  const data = response.data as SetupStatus;
  return data.needsCredentialUpdate === true;
};
```

### 2. Update Admin Credentials
```typescript
type UpdateAdminPayload = {
  currentUsername: string; // typically "admin"
  currentPassword: string; // default trial password
  newUsername: string;
  newPassword: string;
  newEmail: string;
  confirmPassword: string;
};

const updateAdmin = async (payload: UpdateAdminPayload) => {
  return await POST_OAM('/oam/setup/update-admin', payload);
};
```

## Error Handling (Simple)

```typescript
try {
  const required = await needsSetup();
  if (required) {
    await updateAdmin(formData);
  }
  navigate('/login');
} catch (error: any) {
  alert('Setup failed: ' + (error?.response?.data?.message || error.message));
}
```

Notes:
- The first update does not require prior auth. After success, the admin must log in with the new credentials.
- On success the backend will clear `must_change_password` and set `credentials_updated = true`.