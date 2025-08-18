🎯 Finalized Implementation Plan

  OAuth Providers: Google & GitHub

  UI Approach: Combined Login/Signup Page

  Email: Required for traditional signup

  Priority: Traditional signup first, but implement both together

  Testing: OAuth credentials available ✅

  ---
  📋 Detailed Implementation Strategy

  1. Combined Page Design

  LoginPage.tsx (Enhanced)
  ┌─────────────────────────────────────┐
  │  [LoxiLB Logo] v.X.X.X             │
  │                                     │
  │  ┌─ Login ─┐ ┌─ Sign Up ─┐         │
  │  │ Active  │ │ Inactive │          │
  │  └─────────┘ └─────────────┘        │
  │                                     │
  │  [Username Field    ]               │
  │  [Password Field    ]               │
  │  [Email Field       ] (signup only) │
  │  [Confirm Password  ] (signup only) │
  │                                     │
  │  [Login/Create Account Button]      │
  │                                     │
  │  ────────── OR ──────────          │
  │                                     │
  │  [🔴 Sign in with Google]          │
  │  [⚫ Sign in with GitHub]          │
  └─────────────────────────────────────┘

  2. State Management Structure

  interface AuthPageState {
    mode: 'login' | 'signup'
    formData: {
      username: string
      password: string
      email: string        // signup only
      confirmPassword: string  // signup only
    }
    oauthLoading: {
      google: boolean
      github: boolean
    }
    traditionalLoading: boolean
    errors: Record<string, string>
  }

  3. API Integration Plan

  Traditional Signup Flow:
  1. User fills form → validate client-side
  2. POST /oam/users {username, password, email}
  3. If success → auto-login via POST /oam/login
  4. Save token → redirect to /instance

  OAuth Flow:
  1. User clicks OAuth button
  2. GET /oam/oauth/{provider} → redirects to provider
  3. Provider authorization → callback to /oam/oauth/{provider}/callback
  4. Backend creates user + returns JWT token
  5. Frontend saves token → redirect to /instance

  4. File Structure

  src/
  ├── components/input/
  │   ├── AuthForm.tsx              # Combined login/signup form
  │   └── OAuthButton.tsx           # Individual OAuth button
  ├── pages/
  │   ├── LoginPage.tsx             # Enhanced with tabs + OAuth
  │   └── OAuthCallbackPage.tsx     # Handle OAuth returns
  ├── connector/
  │   ├── oauth.ts                  # OAuth API functions
  │   └── user.ts                   # User creation API
  └── types/
      ├── oauth.ts                  # OAuth types
      └── user.ts                   # User creation types

  5. Implementation Steps

  Phase 1: Enhanced LoginPage Structure
  - Add tab switching (Login ↔ Sign Up)
  - Create AuthForm component with mode switching
  - Implement form validation logic

  Phase 2: Traditional Signup
  - Add email + confirm password fields
  - Create user creation API connector
  - Implement signup → auto-login flow

  Phase 3: OAuth Integration
  - Create OAuthButton components for Google & GitHub
  - Implement OAuth redirect handling
  - Create callback page for OAuth returns

  Phase 4: Polish & Testing
  - Add loading states for all flows
  - Enhance error handling
  - Test complete user journeys

  6. Form Validation Rules

  Login Mode:
  - Username: Required
  - Password: Required

  Signup Mode:
  - Username: Required, 3-50 chars, alphanumeric + underscore
  - Email: Required, valid email format
  - Password: Required, min 8 chars, complexity rules
  - Confirm Password: Required, must match password

  Real-time Validation:
  - Show errors on blur (not while typing)
  - Clear errors when user starts fixing them
  - Submit button disabled until all fields valid

  7. OAuth Button Design

  // Google: Red background, white text, Google icon
  // GitHub: Dark background, white text, GitHub icon
  // Consistent sizing and spacing
  // Loading states with spinners
  // Error states with retry options

  8. Error Handling Strategy

  Traditional Signup Errors:
  - Username already exists
  - Email already registered
  - Password too weak
  - Network/server errors

  OAuth Errors:
  - User denies permission
  - Provider is down
  - Account already exists with different method
  - Network/callback errors

  UI Error Display:
  - Form field errors: Under each field
  - General errors: Alert banner at top
  - OAuth errors: Modal or banner with retry option

  ---
  🚀 Ready to Implement?

  This plan covers:
  - ✅ Combined login/signup page with tabs
  - ✅ Traditional signup with required email
  - ✅ Google & GitHub OAuth integration
  - ✅ Proper validation and error handling
  - ✅ Clean file organization
  - ✅ Progressive implementation approach