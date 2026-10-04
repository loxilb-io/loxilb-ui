//---------------------------------------------------------
// User Management Hooks
//---------------------------------------------------------
import {
    query_get_all_users,
    request_update_user,
    request_delete_user
} from 'connector/oam/oam';
import { create_user } from 'connector/user';
import { t } from 'i18next';
import { useQueryOAMData } from './common';
import { IUserUpdateRequest, ICreateUserRequest } from 'types/user';

//---------------------------------------------------------
// Data Fetching Hooks
//---------------------------------------------------------

export function useAllUsers() {
    const query = useQueryOAMData(
        ['all_users'], 
        query_get_all_users
    );
    const { data: users = [], refetch, isLoading, error } = query;

    return {
        users,
        refetch,
        isLoading,
        error,
        // The un-defaulted query, so the page can tell "the read failed" from
        // "there are no users". The `users = ` default above
        // erases exactly that distinction for every other caller.
        query
    };
}

//---------------------------------------------------------
// User Management Action Functions
//---------------------------------------------------------

/**
 * Action function to update a user
 */
export const updateUser = async (id: number, userData: IUserUpdateRequest) => {
    const result = await request_update_user(id, userData);
    if (result.status !== 'confirmed') {
        // Thrown message is already localized (raw server prose stays in
        // result.rawDetail, diagnostics only).
        throw new Error(t(result.localeKey));
    }
    return result;
};

/**
 * Action function to delete a user
 */
export const deleteUser = async (id: number) => {
    const result = await request_delete_user(id);
    if (result.status !== 'confirmed') {
        throw new Error(t(result.localeKey));
    }
    return result;
};

/**
 * Action function to create a new user
 */
export const createUser = async (userData: ICreateUserRequest) => {
    const result = await create_user(userData);
    return result;
};