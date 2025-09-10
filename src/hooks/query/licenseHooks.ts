//---------------------------------------------------------
// License Management Hooks
//---------------------------------------------------------
import { 
    request_install_license,
    request_upgrade_license,
    query_check_feature_access,
    request_validate_license,
    query_get_user_licenses,
    request_update_user_license,
    query_get_user_license_status,
    request_deactivate_user_license
} from 'connector/oam/oam';
import { useCallback, useMemo } from 'react';
import { useQueryOAMData } from './common';
import { IInstallLicenseRequest, IUpdateLicenseRequest } from 'types/license';

//---------------------------------------------------------
// Data Fetching Hooks
//---------------------------------------------------------

export function useLicenseStatus() {
    // Use the new user licenses endpoint to get status of first active license
    const { data: userLicenses } = useQueryOAMData(
        ['user_licenses'], 
        query_get_user_licenses
    );

    const firstActiveLicense = userLicenses?.licenses?.find(license => license.is_active);
    const licenseId = firstActiveLicense?.id;

    const { data: license_status, refetch, isLoading, error } = useQueryOAMData(
        ['license_status', licenseId?.toString() ?? 'none'], 
        () => licenseId ? query_get_user_license_status(licenseId) : Promise.resolve(undefined),
        !!licenseId
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

export function useFeatureAccess() {
    const checkAccess = useCallback(async (feature: string) => {
        return await query_check_feature_access(feature);
    }, []);

    return { checkAccess };
}

//---------------------------------------------------------
// User License Management Hooks
//---------------------------------------------------------

export function useUserLicenses() {
    const { data: userLicenses, refetch, isLoading, error } = useQueryOAMData(
        ['user_licenses'], 
        query_get_user_licenses
    );

    const validLicenses = useMemo(() => userLicenses?.licenses?.filter(license => license.is_active) || [], [userLicenses]);
    const expiredLicenses = useMemo(() => userLicenses?.licenses?.filter(license => !license.is_active) || [], [userLicenses]);

    return {
        userLicenses,
        validLicenses,
        expiredLicenses,
        totalCount: userLicenses?.total_count ?? 0,
        validCount: userLicenses?.valid_count ?? 0,
        expiredCount: userLicenses?.expired_count ?? 0,
        refetch,
        isLoading,
        error
    };
}

export function useUserLicenseStatus(licenseId: number) {
    const { data: licenseStatus, refetch, isLoading, error } = useQueryOAMData(
        ['user_license_status', licenseId.toString()], 
        () => query_get_user_license_status(licenseId)
    );

    return {
        licenseStatus,
        refetch,
        isLoading,
        error
    };
}

//---------------------------------------------------------
// License Action Functions
//---------------------------------------------------------

/**
 * Action function to install a license
 */
export const installLicense = async (licenseData: IInstallLicenseRequest) => {
    return request_install_license(licenseData);
};

/**
 * Action function to upgrade a license
 */
export const upgradeLicense = async (licenseData: any) => {
    return request_upgrade_license(licenseData);
};

/**
 * Action function to update a user license
 */
export const updateUserLicense = async (licenseId: number, param: IUpdateLicenseRequest) => {
    return request_update_user_license(licenseId, param);
};

/**
 * Action function to deactivate a user license
 */
export const deactivateUserLicense = async (licenseId: number) => {
    return request_deactivate_user_license(licenseId);
};

/**
 * Action function to validate a license
 */
export const validateLicense = async (licenseData: any) => {
    return request_validate_license(licenseData);
};