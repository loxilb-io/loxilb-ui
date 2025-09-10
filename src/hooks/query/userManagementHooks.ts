//---------------------------------------------------------
// User Management Hooks
//---------------------------------------------------------
import { 
    query_get_all_users,
    request_update_user,
    request_delete_user
} from 'connector/oam/oam';
import { useQueryOAMData } from './common';
import { IUserUpdateRequest } from 'types/user';

//---------------------------------------------------------
// Data Fetching Hooks
//---------------------------------------------------------

export function useAllUsers() {
    const { data: users = [], refetch, isLoading, error } = useQueryOAMData(
        ['all_users'], 
        query_get_all_users
    );

    return {
        users,
        refetch,
        isLoading,
        error
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
    if (result.status === 'error') {
        throw new Error(result.error);
    }
    return result;
};

/**
 * Action function to delete a user
 */
export const deleteUser = async (id: number) => {
    return request_delete_user(id);
};