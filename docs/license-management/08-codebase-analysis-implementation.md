# License Management Implementation - Based on Current Codebase Analysis

## 🔍 Current Architecture Analysis

### Existing Patterns Identified:

1. **API Connector Pattern**
   - `/src/connector/oam/` for OAM-specific API calls
   - `/src/connector/fetcher/fetcher_oam.ts` for HTTP operations
   - `/src/connector/user.ts` for authentication logic

2. **State Management Stack**
   - **Recoil** for global state atoms (`atoms.tsx`)
   - **React Query** for server state and caching
   - **Custom hooks** pattern for business logic

3. **Hook Architecture**
   - `/src/hooks/query/` for React Query hooks
   - Generic helpers: `useQueryOAMData`, `useQueryInstanceData`
   - Domain-specific hooks: `useInstances()`, `useMyInfo()`

4. **Type System**
   - `/src/types/` organized by domain
   - Existing: `IUser`, `ILoginResponse`, `ICreateUserRequest`

## 🚀 Implementation Plan Following Existing Patterns

### Phase 1: API Layer & Types (Following Existing Patterns)

#### 1.1 License API Connector
**File**: `/src/connector/oam/license.ts`
```typescript
//---------------------------------------------------------
// License Management Connector Functions
//---------------------------------------------------------
import { ApiResult, SimpleResponse } from '../fetcher/fetcher_base';
import { GET_OAM, POST_OAM } from '../fetcher/fetcher_oam';
import { 
    ILicenseStatusResponse, 
    IInstallLicenseRequest, 
    IUpdateLicenseRequest,
    ILicensePayload 
} from 'types/license';

export async function query_get_license_status(): Promise<ILicenseStatusResponse | undefined> {
    const resp = await GET_OAM('/license/status');
    return resp.data as ILicenseStatusResponse;
}

export async function request_install_license(param: IInstallLicenseRequest): Promise<ApiResult> {
    const resp = await POST_OAM('/license/install', param);
    if (resp.code !== 201 && resp.code !== 200) {
        return { status: 'error', error: `Failed to install license: ${resp.message}` };
    }
    return { status: 'success' };
}

export async function request_upgrade_license(param: IUpdateLicenseRequest): Promise<ApiResult> {
    const resp = await POST_OAM('/license/upgrade', param);
    if (resp.code !== 200) {
        return { status: 'error', error: `Failed to upgrade license: ${resp.message}` };
    }
    return { status: 'success' };
}

export async function request_validate_license(param: IInstallLicenseRequest): Promise<ILicensePayload | undefined> {
    const resp = await POST_OAM('/license/validate', param);
    if (resp.code !== 200) return undefined;
    return resp.data as ILicensePayload;
}

export async function query_check_feature_access(feature: string): Promise<boolean> {
    const resp = await GET_OAM('/license/feature-access', { feature });
    return resp.code === 200;
}
```

#### 1.2 Enhanced Type Definitions  
**File**: `/src/types/license.ts`
```typescript
//---------------------------------------------------------
// License Management Types
//---------------------------------------------------------

export type LicenseType = 'trial' | 'enterprise';

export interface IActiveLicense {
    id: number;
    user_id: number;
    username: string;
    license_type: LicenseType;
    is_active: boolean;
    installed_at: string;
    expires_at: string;
    license_key_hash: string;
}

export interface ILicenseStatusResponse {
    is_valid: boolean;
    is_expiring: boolean; // < 7 days
    days_left: number;
    message: string;
    upgrade_url: string;
    license: IActiveLicense;
}

export interface IInstallLicenseRequest {
    license_key: string;
}

export interface IUpdateLicenseRequest {
    license_key: string;
}

export interface ILicensePayload {
    username: string;
    expiry: string;
}
```

#### 1.3 Enhanced User Types
**Update**: `/src/types/user.ts`
```typescript
// Add enhanced login response to existing file
export interface IEnhancedLoginResponse {
    id: number;
    token: string;
    has_valid_license: boolean;
    license_expiring: boolean;
    days_left: number;
    license_status: ILicenseStatusResponse;
}

// Enhance existing ICreateUserRequest
export interface ICreateUserRequest {
    username: string;
    password: string;
    email: string; // Make required based on new API
    license_key?: string; // Optional license assignment
    role?: string; // Optional role assignment
}
```

### Phase 2: State Management (Following Existing Patterns)

#### 2.1 License Atoms
**Update**: `/src/atoms.tsx`
```typescript
// Add to existing atoms
export const license_status_atom = atom<ILicenseStatusResponse | null>({
    key: 'license_status',
    default: null,
});

export const feature_access_cache_atom = atom<Record<string, boolean>>({
    key: 'feature_access_cache', 
    default: {},
});

export const license_loading_atom = atom<boolean>({
    key: 'license_loading',
    default: false,
});
```

#### 2.2 License Query Hooks
**File**: `/src/hooks/query/licenseHooks.ts`
```typescript
//---------------------------------------------------------
// License Management Hooks
//---------------------------------------------------------
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    query_get_license_status,
    request_install_license,
    request_upgrade_license,
    query_check_feature_access,
    request_validate_license
} from 'connector/oam/license';
import { useCallback, useMemo } from 'react';
import { useQueryOAMData } from './common';

export function useLicenseStatus() {
    const { data: license_status, refetch, isLoading, error } = useQueryOAMData(
        ['license_status'], 
        query_get_license_status
    );

    const isValid = useMemo(() => license_status?.is_valid ?? false, [license_status]);
    const isExpiring = useMemo(() => license_status?.is_expiring ?? false, [license_status]);
    const daysLeft = useMemo(() => license_status?.days_left ?? 0, [license_status]);
    const licenseType = useMemo(() => license_status?.license?.license_type, [license_status]);

    return {
        license_status,
        isValid,
        isExpiring, 
        daysLeft,
        licenseType,
        refetch,
        isLoading,
        error
    };
}

export function useLicenseActions() {
    const queryClient = useQueryClient();

    const installMutation = useMutation({
        mutationFn: request_install_license,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['license_status'] });
        }
    });

    const upgradeMutation = useMutation({
        mutationFn: request_upgrade_license,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['license_status'] });
        }
    });

    const validateMutation = useMutation({
        mutationFn: request_validate_license
    });

    return {
        installLicense: installMutation.mutate,
        upgradeLicense: upgradeMutation.mutate,
        validateLicense: validateMutation.mutate,
        isInstalling: installMutation.isPending,
        isUpgrading: upgradeMutation.isPending,
        isValidating: validateMutation.isPending,
        installError: installMutation.error,
        upgradeError: upgradeMutation.error,
        validateError: validateMutation.error,
        validateResult: validateMutation.data
    };
}

export function useFeatureAccess() {
    const checkAccess = useCallback(async (feature: string) => {
        return await query_check_feature_access(feature);
    }, []);

    return { checkAccess };
}
```

### Phase 3: UI Components (Following Existing Patterns)

#### 3.1 License Status Component
**File**: `/src/components/license/LicenseStatusCard.tsx`
```typescript
//---------------------------------------------------------
// License Status Display Component
//---------------------------------------------------------
import React from 'react';
import { useLicenseStatus } from 'hooks/query/licenseHooks';

interface ILicenseStatusCardProps {
    className?: string;
    showActions?: boolean;
    compact?: boolean;
    onManageLicense?: () => void;
}

export const LicenseStatusCard: React.FC<ILicenseStatusCardProps> = ({
    className = '',
    showActions = true,
    compact = false,
    onManageLicense
}) => {
    const { license_status, isValid, isExpiring, daysLeft, licenseType, isLoading } = useLicenseStatus();

    if (isLoading) {
        return (
            <div className={`license-status-card loading ${className}`}>
                <div className="animate-pulse">Loading license status...</div>
            </div>
        );
    }

    if (!license_status) {
        return (
            <div className={`license-status-card no-license ${className}`}>
                <div className="text-gray-500">No license installed</div>
                {showActions && (
                    <button 
                        onClick={onManageLicense}
                        className="btn btn-primary"
                    >
                        Install License
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={`license-status-card ${isValid ? 'valid' : 'invalid'} ${className}`}>
            <div className="license-info">
                <div className="license-type">
                    <span className={`badge ${licenseType}`}>{licenseType?.toUpperCase()}</span>
                </div>
                
                {!compact && (
                    <div className="license-details">
                        <div className="expiration">
                            {isExpiring ? (
                                <span className="text-warning">Expires in {daysLeft} days</span>
                            ) : (
                                <span className="text-success">{daysLeft} days remaining</span>
                            )}
                        </div>
                        <div className="status">
                            Status: {isValid ? 'Active' : 'Inactive'}
                        </div>
                    </div>
                )}
            </div>

            {showActions && (
                <div className="license-actions">
                    <button onClick={onManageLicense} className="btn btn-secondary">
                        Manage License
                    </button>
                </div>
            )}
        </div>
    );
};
```

#### 3.2 Feature Gate Component
**File**: `/src/components/license/FeatureGate.tsx`
```typescript
//---------------------------------------------------------
// Feature Access Control Component
//---------------------------------------------------------
import React, { useEffect, useState } from 'react';
import { useFeatureAccess } from 'hooks/query/licenseHooks';

interface IFeatureGateProps {
    feature: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
    showUpgradePrompt?: boolean;
    loadingComponent?: React.ReactNode;
}

export const FeatureGate: React.FC<IFeatureGateProps> = ({
    feature,
    children,
    fallback,
    showUpgradePrompt = true,
    loadingComponent
}) => {
    const [hasAccess, setHasAccess] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { checkAccess } = useFeatureAccess();

    useEffect(() => {
        const checkFeature = async () => {
            setIsLoading(true);
            try {
                const access = await checkAccess(feature);
                setHasAccess(access);
            } catch (error) {
                console.error(`Failed to check access for feature ${feature}:`, error);
                setHasAccess(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkFeature();
    }, [feature, checkAccess]);

    if (isLoading) {
        return loadingComponent || <div className="feature-gate-loading">Checking permissions...</div>;
    }

    if (hasAccess) {
        return <>{children}</>;
    }

    if (fallback) {
        return <>{fallback}</>;
    }

    if (showUpgradePrompt) {
        return (
            <div className="feature-gate-restricted">
                <div className="upgrade-prompt">
                    <h4>Premium Feature</h4>
                    <p>This feature requires an Enterprise license.</p>
                    <button className="btn btn-primary">Upgrade License</button>
                </div>
            </div>
        );
    }

    return null;
};
```

### Phase 4: Integration with Existing Auth Flow

#### 4.1 Enhanced Authentication
**Update**: `/src/connector/user.ts` (modify existing login function)
```typescript
// Modify existing login_user function to handle enhanced response
export async function login_user(credentials: ILoginRequest): Promise<IEnhancedLoginResponse> {
    try {
        const response: SimpleResponse = await POST_OAM('/login', credentials);
        
        if (response.code !== 200) {
            // ... existing error handling
        }

        // Handle both legacy and enhanced login responses
        const loginData = response.data;
        
        // Check if it's enhanced response with license data
        if (loginData.license_status) {
            return loginData as IEnhancedLoginResponse;
        } else {
            // Legacy response - convert to enhanced format
            return {
                ...loginData,
                has_valid_license: false,
                license_expiring: false,
                days_left: 0,
                license_status: null
            } as IEnhancedLoginResponse;
        }
    } catch (error) {
        console.error('User login failed:', error);
        throw error;
    }
}
```

## 🔧 Implementation Steps Summary

1. **Follow Existing Patterns**: Use `/src/connector/oam/license.ts` pattern
2. **Extend Type System**: Add `/src/types/license.ts` and enhance existing user types  
3. **Use React Query**: Create license hooks in `/src/hooks/query/licenseHooks.ts`
4. **Add Recoil Atoms**: Extend `/src/atoms.tsx` with license state
5. **Build UI Components**: Follow existing component patterns
6. **Integrate with Auth**: Enhance existing login flow

## ✅ Benefits of Following Existing Patterns

- **Consistency**: Maintains codebase consistency and readability
- **Maintainability**: Follows established patterns developers already understand  
- **Performance**: Leverages existing React Query caching and optimization
- **Type Safety**: Builds on existing TypeScript infrastructure
- **Testing**: Can use existing testing patterns and utilities

This approach ensures the license management system integrates seamlessly with the existing loxilb-ui architecture while maintaining code quality and consistency.