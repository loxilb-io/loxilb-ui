# Technical Specifications: Initial User Onboarding

## Overview

This document provides detailed technical specifications for implementing the initial user onboarding system in loxilb-ui, based on the approved design requirements.

## Core Requirements Summary

1. **Setup Flow**: 6-step wizard (Welcome → Admin Setup → Security → LoxiLB Connection → Config → Completion)
2. **Password Policy**: 9+ chars with specific validation rules
3. **LoxiLB Integration**: Connection validation and health checks
4. **Component Strategy**: Reuse existing MUI components, minimize new components
5. **Admin Handling**: Force immediate password change for default credentials

## Detailed Technical Specifications

### 1. State Management

#### Setup State Atom
**File**: `src/atoms.tsx` (extend existing)
```typescript
export interface ISetupState {
  isFirstTime: boolean;
  currentStep: number;
  completedSteps: number[];
  adminConfigured: boolean;
  passwordPolicyEnforced: boolean;
  loxilbConnected: boolean;
  setupCompleted: boolean;
  adminCredentials?: {
    username: string;
    email: string;
    hasDefaultPassword: boolean;
  };
  loxilbConfig?: {
    host: string;
    port: number;
    apiVersion: string;
    healthStatus: 'unknown' | 'healthy' | 'unhealthy';
  };
}

export const setupStateAtom = atom<ISetupState>({
  key: 'setupState',
  default: {
    isFirstTime: false,
    currentStep: 0,
    completedSteps: [],
    adminConfigured: false,
    passwordPolicyEnforced: false,
    loxilbConnected: false,
    setupCompleted: false,
  },
});

export const setupStepAtom = atom<number>({
  key: 'setupStep',
  default: 0,
});
```

#### Setup Detection Logic
**File**: `src/utils/setupDetection.ts` (new)
```typescript
export interface ISetupStatus {
  isFirstTime: boolean;
  adminExists: boolean;
  defaultPasswordInUse: boolean;
  loxilbConfigured: boolean;
  requiresPasswordChange: boolean;
}

export const checkSetupStatus = async (): Promise<ISetupStatus> => {
  // Implementation details:
  // 1. Check localStorage for 'setup_completed' flag
  // 2. Check if admin user exists via API
  // 3. Validate current admin password against default
  // 4. Check loxilb connection status
  // 5. Return comprehensive status
};

export const detectFirstTimeSetup = (): boolean => {
  const setupCompleted = localStorage.getItem('setup_completed');
  const hasToken = localStorage.getItem('access_token');
  return !setupCompleted && !hasToken;
};
```

### 2. Enhanced Password Validation

#### Extended Validation Function
**File**: `src/utils/enhancedPasswordValidation.ts` (new)
```typescript
export interface IPasswordValidationResult {
  isValid: boolean;
  messages: string[];
  strength: 'weak' | 'medium' | 'strong';
}

export interface IPasswordValidationOptions {
  username?: string;
  previousPassword?: string;
}

export const validatePasswordEnhanced = (
  password: string,
  options: IPasswordValidationOptions = {}
): IPasswordValidationResult => {
  const messages: string[] = [];
  let isValid = true;

  // Reuse existing validation from src/connector/user.ts
  const basicValidation = validate_password(password);
  if (!basicValidation.isValid && basicValidation.message) {
    messages.push(basicValidation.message);
    isValid = false;
  }

  // Additional validations based on requirements:

  // 1. Same character repetition check
  if (/(.)\1{2,}/.test(password)) {
    messages.push('Must not contain the same character more than twice in a row');
    isValid = false;
  }

  // 2. Consecutive characters check
  if (hasConsecutiveCharacters(password)) {
    messages.push('Must not contain consecutive characters');
    isValid = false;
  }

  // 3. Username comparison
  if (options.username && password.toLowerCase() === options.username.toLowerCase()) {
    messages.push('Must not be the same as the username');
    isValid = false;
  }

  // 4. Previous password comparison
  if (options.previousPassword && password === options.previousPassword) {
    messages.push('Must not be the same as the previous password');
    isValid = false;
  }

  return {
    isValid,
    messages,
    strength: calculatePasswordStrength(password)
  };
};

const hasConsecutiveCharacters = (password: string): boolean => {
  // Check for consecutive ASCII characters (e.g., "abc", "123")
  for (let i = 0; i < password.length - 2; i++) {
    const char1 = password.charCodeAt(i);
    const char2 = password.charCodeAt(i + 1);
    const char3 = password.charCodeAt(i + 2);

    if (char2 === char1 + 1 && char3 === char2 + 1) {
      return true;
    }
  }
  return false;
};

const calculatePasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
  // Implementation based on multiple criteria
  // Returns strength level for UI feedback
};
```

### 3. Setup Wizard Components

#### Main Setup Wizard
**File**: `src/components/setup/SetupWizard.tsx` (new)
```typescript
export interface ISetupWizardProps {
  onComplete: () => void;
  onCancel?: () => void;
}

export const SetupWizard: React.FC<ISetupWizardProps> = ({ onComplete, onCancel }) => {
  // Component structure:
  // 1. Reuse LoginPage layout pattern
  // 2. Use MUI Stepper for navigation
  // 3. Manage step state with Recoil
  // 4. Handle step validation and progression

  const steps = [
    { label: 'Welcome', component: WelcomeStep },
    { label: 'Admin Setup', component: AdminSetupStep },
    { label: 'Security', component: SecurityStep },
    { label: 'LoxiLB Connection', component: LoxilbConnectionStep },
    { label: 'Configuration', component: ConfigurationStep },
    { label: 'Complete', component: CompletionStep }
  ];

  // Implementation reuses:
  // - BackBoard and Particles from LoginPage
  // - Container and Paper styling patterns
  // - Form validation patterns from AuthForm
};
```

#### Step Components Structure
**Files**: `src/components/setup/steps/` (new directory)

1. **WelcomeStep.tsx**
   - Introduction and overview
   - System requirements check
   - Reuses: Typography patterns, Button styling

2. **AdminSetupStep.tsx**
   - Admin account creation/modification
   - Reuses: AuthForm validation patterns, TextField components

3. **SecurityStep.tsx**
   - Password policy configuration
   - Password change enforcement
   - Reuses: Password validation display from AuthForm

4. **LoxilbConnectionStep.tsx**
   - Connection configuration
   - Health check validation
   - Reuses: Form patterns, status indicators

5. **ConfigurationStep.tsx**
   - Basic loxilb settings
   - Initial configuration options
   - Reuses: Form components, validation patterns

6. **CompletionStep.tsx**
   - Setup summary
   - Next steps guidance
   - Reuses: Typography, Button patterns

### 4. API Integration

#### Setup API Functions
**File**: `src/connector/setup.ts` (new)
```typescript
export interface IAdminSetupRequest {
  username: string;
  email: string;
  password: string;
  forcePasswordChange?: boolean;
}

export interface ILoxilbConnectionConfig {
  host: string;
  port: number;
  apiVersion?: string;
  timeout?: number;
}

export interface ILoxilbHealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  message?: string;
  details?: any;
}

// API Functions
export const setupAdmin = async (config: IAdminSetupRequest): Promise<void> => {
  // Implementation follows patterns from src/connector/user.ts
};

export const validateLoxilbConnection = async (
  config: ILoxilbConnectionConfig
): Promise<ILoxilbHealthStatus> => {
  // Connection validation logic
};

export const checkLoxilbHealth = async (): Promise<ILoxilbHealthStatus> => {
  // Health check implementation
};

export const finalizeSetup = async (): Promise<void> => {
  // Mark setup as completed
  localStorage.setItem('setup_completed', 'true');
  localStorage.setItem('setup_date', new Date().toISOString());
};
```

### 5. Routing Integration

#### Route Guards
**File**: `src/components/routing/SetupGuard.tsx` (new)
```typescript
export interface ISetupGuardProps {
  children: React.ReactNode;
  requireSetup?: boolean;
}

export const SetupGuard: React.FC<ISetupGuardProps> = ({
  children,
  requireSetup = true
}) => {
  // Implementation:
  // 1. Check setup status on mount
  // 2. Redirect to setup if incomplete
  // 3. Allow bypass for specific routes
  // 4. Handle loading states
};
```

#### Route Configuration Updates
**File**: `src/App.tsx` (modify existing)
```typescript
// Add new routes:
<Route path="/setup" element={<SetupGuard><SetupWizard /></SetupGuard>} />
<Route path="/setup/password" element={<PasswordChangeWizard />} />

// Wrap existing routes with setup guard:
<Route path="/instance" element={<SetupGuard requireSetup={false}><InstancePage /></SetupGuard>} />
```

### 6. Password Change Enforcement

#### Password Enforcement Hook
**File**: `src/hooks/usePasswordEnforcement.ts` (new)
```typescript
export interface IPasswordEnforcementState {
  requiresChange: boolean;
  isDefault: boolean;
  canBypass: boolean;
  enforcementReason: string;
}

export const usePasswordEnforcement = (): IPasswordEnforcementState => {
  // Implementation:
  // 1. Check for default passwords
  // 2. Validate against policy
  // 3. Return enforcement state
  // 4. Handle bypass conditions
};
```

#### Password Change Component
**File**: `src/components/security/PasswordChangeWizard.tsx` (new)
```typescript
export interface IPasswordChangeWizardProps {
  enforced?: boolean;
  onComplete: () => void;
  onCancel?: () => void;
}

export const PasswordChangeWizard: React.FC<IPasswordChangeWizardProps> = ({
  enforced = false,
  onComplete,
  onCancel
}) => {
  // Reuses:
  // - AuthForm validation patterns
  // - Enhanced password validation
  // - Form styling from existing components
};
```

### 7. LoxiLB Integration Components

#### Connection Validator
**File**: `src/components/loxilb/LoxilbConnectionValidator.tsx` (new)
```typescript
export interface IConnectionValidatorProps {
  config: ILoxilbConnectionConfig;
  onValidation: (result: ILoxilbHealthStatus) => void;
  autoValidate?: boolean;
}

export const LoxilbConnectionValidator: React.FC<IConnectionValidatorProps> = ({
  config,
  onValidation,
  autoValidate = true
}) => {
  // Implementation:
  // 1. Real-time connection testing
  // 2. Health check validation
  // 3. Status visualization
  // 4. Error handling and retry logic
};
```

#### Setup Guide Component
**File**: `src/components/loxilb/LoxilbSetupGuide.tsx` (new)
```typescript
export interface ISetupGuideProps {
  interactive?: boolean;
  showTroubleshooting?: boolean;
}

export const LoxilbSetupGuide: React.FC<ISetupGuideProps> = ({
  interactive = true,
  showTroubleshooting = true
}) => {
  // Features:
  // 1. Step-by-step installation guide
  // 2. Configuration examples
  // 3. Troubleshooting section
  // 4. Integration testing tools
};
```

### 8. Storage Management

#### Setup Storage Keys
```typescript
// localStorage keys used by setup system
export const SETUP_STORAGE_KEYS = {
  SETUP_COMPLETED: 'setup_completed',
  SETUP_DATE: 'setup_date',
  ADMIN_PASSWORD_CHANGED: 'admin_password_changed',
  LOXILB_CONFIGURED: 'loxilb_configured',
  SETUP_VERSION: 'setup_version', // For future migrations
} as const;

// Setup storage utilities
export const setupStorage = {
  markCompleted: () => {
    localStorage.setItem(SETUP_STORAGE_KEYS.SETUP_COMPLETED, 'true');
    localStorage.setItem(SETUP_STORAGE_KEYS.SETUP_DATE, new Date().toISOString());
    localStorage.setItem(SETUP_STORAGE_KEYS.SETUP_VERSION, '1.0.0');
  },

  isCompleted: (): boolean => {
    return localStorage.getItem(SETUP_STORAGE_KEYS.SETUP_COMPLETED) === 'true';
  },

  reset: () => {
    Object.values(SETUP_STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }
};
```

### 9. Internationalization Extensions

#### Translation Structure
**Files**: `src/locales/*/setup.json` (new files)
```json
{
  "setup": {
    "wizard": {
      "title": "Initial Setup",
      "subtitle": "Let's configure your LoxiLB UI"
    },
    "steps": {
      "welcome": {
        "title": "Welcome to LoxiLB UI",
        "subtitle": "A powerful load balancer management interface",
        "description": "This setup wizard will guide you through the initial configuration process."
      },
      "admin": {
        "title": "Admin Account Setup",
        "subtitle": "Configure your administrator account",
        "createNew": "Create New Admin Account",
        "modifyExisting": "Modify Existing Account"
      },
      "security": {
        "title": "Security Configuration",
        "subtitle": "Set up password policies and security settings",
        "passwordPolicy": "Password Policy",
        "requirements": {
          "length": "Must be at least 9 characters long",
          "uppercase": "Must contain at least one uppercase letter",
          "lowercase": "Must contain at least one lowercase letter",
          "number": "Must contain at least one number",
          "special": "Must contain at least one special character",
          "noRepeat": "Must not contain the same character more than twice in a row",
          "noConsecutive": "Must not contain consecutive characters",
          "notUsername": "Must not be the same as the username",
          "notPrevious": "Must not be the same as the previous password"
        }
      },
      "loxilb": {
        "title": "LoxiLB Connection",
        "subtitle": "Configure connection to your LoxiLB instance",
        "connection": "Connection Settings",
        "health": "Health Check",
        "status": {
          "healthy": "Connection healthy",
          "unhealthy": "Connection failed",
          "unknown": "Connection not tested"
        }
      },
      "config": {
        "title": "Initial Configuration",
        "subtitle": "Basic LoxiLB settings and preferences"
      },
      "complete": {
        "title": "Setup Complete",
        "subtitle": "Your LoxiLB UI is ready to use",
        "summary": "Setup Summary",
        "nextSteps": "Next Steps"
      }
    },
    "buttons": {
      "next": "Next",
      "previous": "Previous",
      "skip": "Skip",
      "finish": "Finish Setup",
      "testConnection": "Test Connection",
      "retryConnection": "Retry Connection"
    },
    "validation": {
      "required": "This field is required",
      "invalidEmail": "Please enter a valid email address",
      "passwordMismatch": "Passwords do not match",
      "connectionFailed": "Failed to connect to LoxiLB instance"
    }
  }
}
```

### 10. Error Handling Strategy

#### Setup Error Types
**File**: `src/types/setupErrors.ts` (new)
```typescript
export enum SetupErrorType {
  ADMIN_CREATION_FAILED = 'ADMIN_CREATION_FAILED',
  PASSWORD_POLICY_VIOLATION = 'PASSWORD_POLICY_VIOLATION',
  LOXILB_CONNECTION_FAILED = 'LOXILB_CONNECTION_FAILED',
  SETUP_VALIDATION_FAILED = 'SETUP_VALIDATION_FAILED',
  STORAGE_ERROR = 'STORAGE_ERROR'
}

export interface ISetupError {
  type: SetupErrorType;
  message: string;
  details?: any;
  recoverable: boolean;
  retryable: boolean;
}

export class SetupError extends Error {
  public readonly type: SetupErrorType;
  public readonly details?: any;
  public readonly recoverable: boolean;
  public readonly retryable: boolean;

  constructor(error: ISetupError) {
    super(error.message);
    this.type = error.type;
    this.details = error.details;
    this.recoverable = error.recoverable;
    this.retryable = error.retryable;
  }
}
```

### 11. Testing Specifications

#### Unit Test Requirements
- Password validation functions
- Setup state management
- API integration functions
- Storage utilities

#### Integration Test Requirements
- Complete setup wizard flow
- Password enforcement workflow
- LoxiLB connection validation
- Route protection verification

#### E2E Test Scenarios
- First-time user complete setup
- Admin password change enforcement
- LoxiLB connection configuration
- Setup wizard interruption and resumption

### 12. Performance Considerations

#### Lazy Loading
```typescript
// Lazy load setup components to reduce initial bundle size
const SetupWizard = lazy(() => import('./components/setup/SetupWizard'));
const PasswordChangeWizard = lazy(() => import('./components/security/PasswordChangeWizard'));
```

#### API Optimization
- Connection validation with timeout
- Health check caching
- Retry logic with exponential backoff
- Request cancellation on component unmount

#### State Management Optimization
- Persist setup state to prevent loss on page refresh
- Selective atom updates to minimize re-renders
- Cleanup setup state after completion

## Implementation Dependencies

### Required Packages
No new packages required - all implementation uses existing dependencies:
- @mui/material (already installed)
- @mui/icons-material (already installed)
- recoil (already installed)
- react-hook-form (already installed)
- i18next (already installed)

### File Structure
```
src/
├── components/
│   ├── setup/
│   │   ├── SetupWizard.tsx
│   │   ├── steps/
│   │   └── shared/
│   ├── security/
│   │   └── PasswordChangeWizard.tsx
│   ├── loxilb/
│   │   ├── LoxilbConnectionValidator.tsx
│   │   └── LoxilbSetupGuide.tsx
│   └── routing/
│       └── SetupGuard.tsx
├── connector/
│   └── setup.ts
├── hooks/
│   └── usePasswordEnforcement.ts
├── utils/
│   ├── setupDetection.ts
│   └── enhancedPasswordValidation.ts
├── types/
│   ├── setup.ts
│   └── setupErrors.ts
└── locales/
    └── */setup.json
```

This technical specification provides the foundation for implementation while ensuring maximum reuse of existing components and patterns.