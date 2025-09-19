# Initial User Onboarding Implementation Plan

## Overview

This document outlines the implementation plan for creating an initial user onboarding flow for loxilb-ui that ensures first-time users are properly guided through setup, security configuration, and loxilb preparation.

## Current System Analysis

### Authentication Architecture
- **Login System**: Traditional username/password + OAuth (Google/GitHub)
- **Token Management**: JWT tokens stored in localStorage (`access_token`)
- **Session Check**: `is_logged_in()` function validates token presence
- **User Management**: Full CRUD operations for users available
- **Current Flow**: Direct login → Dashboard (`/instance`)

### Existing Components
- `LoginPage.tsx`: Handles authentication with tabs for login/signup
- `UserManagementPage.tsx`: Admin interface for user management
- `connector/user.ts`: User authentication and validation APIs
- `common.ts`: Authentication utilities

## Implementation Strategy

### Phase 1: First-Time Setup Detection

#### 1.1 Setup State Management
**Location**: `src/atoms.tsx` (Recoil state)
```typescript
// New atoms to add
export const isFirstTimeSetupState = atom<boolean>({
  key: 'isFirstTimeSetup',
  default: false,
});

export const setupStepState = atom<number>({
  key: 'setupStep',
  default: 0,
});
```

#### 1.2 Setup Detection Logic
**Location**: `src/utils/setupDetection.ts` (New file)
- Check for admin user existence
- Check for default password usage
- Check for loxilb configuration status
- Return setup completion status

#### 1.3 Storage Keys
- `setup_completed`: Boolean flag in localStorage
- `admin_password_changed`: Boolean flag for password enforcement
- `loxilb_configured`: Boolean flag for loxilb setup

### Phase 2: First-Time Setup Wizard

#### 2.1 Setup Wizard Component
**Location**: `src/components/setup/FirstTimeSetupWizard.tsx` (New file)

**Features**:
- Multi-step wizard using MUI Stepper
- Progress tracking with Recoil state
- Form validation using React Hook Form
- Internationalization support

**Steps**:
1. **Welcome & Overview** - Introduction to loxilb-ui
2. **Admin Account Setup** - Create/modify admin credentials
3. **Security Configuration** - Password policy enforcement
4. **LoxiLB Connection** - Configure loxilb instance connection
5. **Initial Configuration** - Basic loxilb settings
6. **Completion** - Setup summary and next steps

#### 2.2 Setup Components Structure
```
src/components/setup/
├── FirstTimeSetupWizard.tsx      # Main wizard container
├── steps/
│   ├── WelcomeStep.tsx            # Step 1: Welcome
│   ├── AdminSetupStep.tsx         # Step 2: Admin setup
│   ├── SecurityStep.tsx           # Step 3: Security config
│   ├── LoxilbConnectionStep.tsx   # Step 4: LoxiLB connection
│   ├── InitialConfigStep.tsx      # Step 5: Basic config
│   └── CompletionStep.tsx         # Step 6: Completion
├── shared/
│   ├── SetupStepContainer.tsx     # Common step wrapper
│   ├── SetupProgress.tsx          # Progress indicator
│   └── SetupNavigation.tsx        # Next/Previous buttons
└── forms/
    ├── AdminCredentialsForm.tsx   # Admin account form
    ├── SecurityPolicyForm.tsx     # Security settings form
    └── LoxilbConfigForm.tsx       # LoxiLB configuration form
```

### Phase 3: Password Change Enforcement

#### 3.1 Password Policy Component
**Location**: `src/components/security/PasswordPolicyChecker.tsx` (New file)
- Real-time password strength indicator
- Policy requirements display
- Visual feedback for compliance

#### 3.2 Forced Password Change Logic
**Location**: `src/hooks/usePasswordEnforcement.ts` (New file)
- Check for default/weak passwords
- Redirect to password change if needed
- Block access until password updated

#### 3.3 Enhanced User Management
**Location**: Extend `src/pages/managers/UserManagementPage.tsx`
- Add password change enforcement flags
- Admin can force password resets
- Bulk password policy application

### Phase 4: LoxiLB Preparation Guide

#### 4.1 LoxiLB Status Checker
**Location**: `src/components/loxilb/LoxilbStatusChecker.tsx` (New file)
- Connection status verification
- Health check implementation
- Configuration validation

#### 4.2 Setup Guide Component
**Location**: `src/components/loxilb/LoxilbSetupGuide.tsx` (New file)
- Step-by-step loxilb installation guide
- Configuration examples
- Troubleshooting section
- Integration testing tools

#### 4.3 Pre-flight Checklist
**Location**: `src/components/setup/PreflightChecklist.tsx` (New file)
- System requirements verification
- Network connectivity tests
- Permissions validation
- Environment setup confirmation

### Phase 5: Router Integration

#### 5.1 Setup Route Guard
**Location**: `src/components/routing/SetupGuard.tsx` (New file)
- Intercept navigation if setup incomplete
- Redirect to setup wizard
- Allow bypass for specific routes

#### 5.2 Route Configuration
**Location**: Update `src/App.tsx`
```typescript
// New routes to add
<Route path="/setup" element={<FirstTimeSetupWizard />} />
<Route path="/setup/password" element={<PasswordChangeWizard />} />
<Route path="/setup/loxilb" element={<LoxilbSetupGuide />} />
```

## Technical Implementation Details

### 1. State Management (Recoil)
```typescript
// Setup state atoms
export const setupStateAtom = atom<ISetupState>({
  key: 'setupState',
  default: {
    currentStep: 0,
    completedSteps: [],
    adminConfigured: false,
    passwordPolicyEnforced: false,
    loxilbConnected: false,
    setupCompleted: false,
  },
});
```

### 2. API Extensions
**Location**: `src/connector/setup.ts` (New file)
```typescript
// Setup-related API functions
export const checkSetupStatus = async (): Promise<ISetupStatus>
export const completeAdminSetup = async (config: IAdminConfig): Promise<void>
export const validateLoxilbConnection = async (config: ILoxilbConfig): Promise<boolean>
export const finalizeSetup = async (): Promise<void>
```

### 3. Type Definitions
**Location**: `src/types/setup.ts` (New file)
```typescript
export interface ISetupState {
  currentStep: number;
  completedSteps: number[];
  adminConfigured: boolean;
  passwordPolicyEnforced: boolean;
  loxilbConnected: boolean;
  setupCompleted: boolean;
}

export interface ISetupStatus {
  isFirstTime: boolean;
  adminExists: boolean;
  defaultPasswordInUse: boolean;
  loxilbConfigured: boolean;
}
```

### 4. Internationalization
**Location**: Update `src/locales/`
- Add setup wizard translations
- Include password policy messages
- LoxiLB configuration instructions

## Security Considerations

### 1. Password Policy Enforcement
- Minimum 12 characters
- Require uppercase, lowercase, numbers, special characters
- Prevent common passwords
- Force change on first login
- Regular expiration (optional)

### 2. Default Account Security
- Disable/rename default admin account
- Force immediate password change
- Generate secure random passwords
- Audit logging for security events

### 3. Session Management
- Secure token storage
- Session timeout enforcement
- Multi-device session tracking
- Forced logout on security events

## User Experience Flow

### 1. First Visit
1. User opens loxilb-ui
2. System detects first-time setup needed
3. Redirect to setup wizard
4. Complete guided setup process
5. Redirect to main dashboard

### 2. Subsequent Visits
1. User opens loxilb-ui
2. System checks setup completion
3. If incomplete, redirect to appropriate step
4. If complete, normal login flow

### 3. Password Enforcement
1. User logs in with default/weak password
2. System detects password policy violation
3. Force redirect to password change
4. Block access until compliant password set

## Testing Strategy

### 1. Unit Tests
- Setup detection logic
- Password validation functions
- State management operations
- API integration functions

### 2. Integration Tests
- Complete setup wizard flow
- Password enforcement workflow
- LoxiLB connection validation
- Route protection verification

### 3. E2E Tests
- First-time user journey
- Admin setup workflow
- Password change enforcement
- LoxiLB configuration process

## Migration Strategy

### 1. Existing Users
- Detect existing installations
- Provide upgrade path for new features
- Optional re-run of setup for missing components
- Preserve existing configurations

### 2. Backward Compatibility
- Maintain existing login flow
- Graceful degradation if setup incomplete
- Preserve existing user data
- Configurable enforcement levels

## Implementation Timeline

### Phase 1: Core Setup Detection (Week 1)
- Setup state management
- Detection logic implementation
- Basic UI components

### Phase 2: Setup Wizard (Week 2-3)
- Multi-step wizard implementation
- Form validation and submission
- Progress tracking

### Phase 3: Password Enforcement (Week 4)
- Password policy implementation
- Enforcement logic
- Security enhancements

### Phase 4: LoxiLB Integration (Week 5)
- Connection validation
- Setup guides
- Pre-flight checks

### Phase 5: Testing & Polish (Week 6)
- Comprehensive testing
- UI/UX improvements
- Documentation completion

## Success Metrics

### 1. User Experience
- Setup completion rate > 95%
- Average setup time < 10 minutes
- User satisfaction score > 4.5/5
- Support ticket reduction

### 2. Security
- 100% default password elimination
- Password policy compliance > 98%
- Zero security incidents related to setup
- Audit compliance achievement

### 3. Technical
- Setup wizard performance < 2s per step
- API response times < 500ms
- Zero setup-related bugs in production
- 100% test coverage for critical paths

## Conclusion

This implementation plan provides a comprehensive approach to creating a user-friendly, secure, and efficient initial onboarding experience for loxilb-ui. The phased approach ensures manageable development cycles while maintaining system stability and user experience quality.