//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import EditIcon from '@mui/icons-material/Edit';
import {Box, Stack, Typography, Tabs, Tab, Button} from '@mui/material';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import ScrollableBox from 'components/layout/ScrollableBox';
import UserManagementTable from 'components/table/managers/UserManagementTable';
import UserEditModal from 'components/modal/UserEditModal';
import {useMyInfo} from 'hooks/query/oamHooks';
import {useAllUsers, updateUser, deleteUser, createUser} from 'hooks/query/userManagementHooks';
import {usePopUp} from 'hooks/popupHook';
import {login_user} from 'connector/user';
import {save_local_storage, move_forced} from 'common';
import {t} from 'i18next';
import {useQueryClient} from '@tanstack/react-query';
import {Fragment, useState, useMemo, useEffect, useCallback, useRef} from 'react';
import {getStableHash} from 'common';
import {IUser} from 'types/oam';
import {IUserUpdateRequest, ICreateUserRequest} from 'types/user';
import {toPageState} from 'components/state/pageState';

//---------------------------------------------------------
// Tab Panel Component
//---------------------------------------------------------
interface TabPanelProps {
	children?: React.ReactNode;
	index: number;
	value: number;
}

function TabPanel(props: TabPanelProps) {
	const {children, value, index, ...other} = props;

	return (
		<div
			role="tabpanel"
			hidden={value !== index}
			id={`user-tabpanel-${index}`}
			aria-labelledby={`user-tab-${index}`}
			{...other}
		>
			{value === index && (
				<Box sx={{pt: 3}}>
					{children}
				</Box>
			)}
		</div>
	);
}

//---------------------------------------------------------
// User Profile Panel
//---------------------------------------------------------
function UserProfilePanel(props: {onEditProfile: () => void}) {
	const {onEditProfile} = props;
	const my_info = useMyInfo();

	const formatDate = (dateStr?: string) => {
		if (!dateStr) return t('Unknown');
		return new Date(dateStr).toLocaleDateString();
	};

	return (
		<Stack spacing={3}>
			<Box display="flex" justifyContent="space-between" alignItems="center">
				<Typography variant="h6" display="flex" alignItems="center" gap={1}>
					<PersonIcon />
					{t('Profile Information')}
				</Typography>
				
				<Button
					variant="outlined"
					startIcon={<EditIcon />}
					onClick={onEditProfile}
					size="small"
				>
					{t('Edit Profile')}
				</Button>
			</Box>

			<ValueBunch>
				<SingleTextBox label={t('User ID')} value={my_info?.id?.toString() || 'N/A'} />
				<SingleTextBox label={t('Username')} value={my_info?.username || 'N/A'} />
				<SingleTextBox label={t('Email')} value={my_info?.email || 'N/A'} />
				<SingleTextBox label={t('Role')} value={my_info?.role || 'N/A'} />
				<SingleTextBox label={t('Account Created')} value={formatDate(my_info?.created_at)} />
			</ValueBunch>
		</Stack>
	);
}

//---------------------------------------------------------
// Password Management Panel
//---------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- parked feature code kept for re-enablement; remove the disable when it is wired back up or deleted
function PasswordManagementPanel() {
	return (
		<Stack spacing={3}>
			<Typography variant="h6" display="flex" alignItems="center" gap={1}>
				<LockIcon />
				{t('Password Management')}
			</Typography>

			<Typography variant="body2" color="text.secondary">
				{t('Password management functionality will be available in a future update.')}
			</Typography>

			<Box sx={{
				padding: 2,
				backgroundColor: 'action.hover',
				borderRadius: 1,
				border: '1px dashed',
				borderColor: 'divider'
			}}>
				<Typography variant="body2" color="text.secondary" align="center">
					{t('Coming Soon: Change Password, Security Settings')}
				</Typography>
			</Box>
		</Stack>
	);
}

//---------------------------------------------------------
// Admin User Management Panel
//---------------------------------------------------------
function AdminUserManagementPanel(props: {
	currentUser: IUser | undefined;
	onEditUser: (user: IUser) => void;
	onAddUser: () => void;
	onRefresh: () => void;
	refetchRef?: React.MutableRefObject<(() => void) | null>;
}) {
	const {currentUser, onEditUser, onAddUser, onRefresh, refetchRef} = props;
	const {users, isLoading, refetch, query: users_query} = useAllUsers();

	const {openPopUp} = usePopUp();
	const [selected_rows, set_selected_rows] = useState<number[]>([]); // holds hash ids

	// Hash function for user — MUST match UserManagementTable.getHashKey
	const getHashKey = (item: IUser) => {
		const str = `${item.id || ''}_${item.username || ''}_${item.email || ''}`;
		return getStableHash(str);
	};

	// Resolve selected users by matching stable hash ids
	const selectedItems = useMemo(
		() =>
			selected_rows
				.map(h => users?.find(a => getHashKey(a) === h))
				.filter((x): x is IUser => x != null),
		[selected_rows, users]
	);
	const selectedItem: IUser | null = selectedItems.length === 1 ? selectedItems[0] : null;

	// Expose refetch function to parent via ref
	useEffect(() => {
		if (refetchRef) {
			refetchRef.current = refetch;
		}
	}, [refetch, refetchRef]);

	// Selection handler: selection model is a list of stable hash ids
	const handleSelectionChange = (hashes: number[]) => set_selected_rows(hashes);

	// DataTable already gates delete behind its own "WARNING!! Delete Item"
	// confirmation, so this runs post-confirm — delete directly rather than
	// stacking a second (redundant) confirm dialog on top of it.
	const handleDeleteUser = async () => {
		if (selectedItems.length === 0) return;

		const selectedUserData = selectedItems;

		// Guard: an admin must not delete their own account — the server permits
		// it (no self-delete protection), which would silently lock the admin out
		// on the next request. Block it here with a clear message.
		if (currentUser && selectedUserData.some(user => user.id === currentUser.id)) {
			openPopUp(t('Cannot Delete'), t('You cannot delete your own account.'), t('OK'));
			return;
		}

		try {
			await Promise.all(selectedUserData.map(user => deleteUser(user.id)));
			set_selected_rows([]);
			onRefresh();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : t('Failed to delete one or more users');
			openPopUp(t('Error'), errorMessage, t('OK'));
		}
	};

	const handleEditUser = () => {
		if (selectedItem) {
			onEditUser(selectedItem);
		}
	};

	const handleRefresh = () => {
		set_selected_rows([]);
		onRefresh();
	};

	if (isLoading) {
		return (
			<Stack spacing={3}>
				<Typography variant="h6" display="flex" alignItems="center" gap={1}>
					<AdminPanelSettingsIcon />
					{t('User Management')}
				</Typography>
				<Typography variant="body2" color="text.secondary">
					{t('Loading users...')}
				</Typography>
			</Stack>
		);
	}

	return (
		<Stack spacing={3}>
			<Typography variant="h6" display="flex" alignItems="center" gap={1}>
				<AdminPanelSettingsIcon />
				{t('User Management')}
			</Typography>

			<Fragment>
				<UserManagementTable
					data={{users: users ?? []}}
					selected_rows={selected_rows}
					onChangeSelectedRows={handleSelectionChange}
					onAdd={onAddUser}
					onUpdate={handleEditUser}
					onDelete={handleDeleteUser}
					onRefresh={handleRefresh}
					currentUserId={currentUser?.id}
					isAdmin={currentUser?.role === 'admin'}
					state={toPageState(users_query, {op: 'user.list'})}
				/>
			</Fragment>
		</Stack>
	);
}

//---------------------------------------------------------
// Main Functional Component
//---------------------------------------------------------
export default function UserManagementPage() {
	const my_info = useMyInfo();
	const isAdmin = my_info?.role === 'admin';
	const {openPopUp} = usePopUp();
	const queryClient = useQueryClient();
	const [tabValue, setTabValue] = useState(0);
	const [editModalOpen, setEditModalOpen] = useState(false);
	const [editingUser, setEditingUser] = useState<IUser | null>(null);
	const [actionError, setActionError] = useState('');

	const [isUpdating, setIsUpdating] = useState(false);
	const userRefetchRef = useRef<(() => void) | null>(null);

	const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
		setTabValue(newValue);
	};

	const handleUserRefresh = useCallback(() => {
		if (userRefetchRef.current) {
			userRefetchRef.current();
		}
	}, []);

	const handleEditProfile = () => {
		if (my_info) {
			setEditingUser(my_info);
			setEditModalOpen(true);
		}
	};

	const handleEditUser = (user: IUser) => {
		setEditingUser(user);
		setEditModalOpen(true);
	};

	const handleAddUser = () => {
		setEditingUser(null); // No user for create mode
		setEditModalOpen(true);
	};

	const handleCloseModal = () => {
		setEditModalOpen(false);
		setEditingUser(null);
		setActionError('');
	};

	const handleSubmitUser = async (userData: IUserUpdateRequest) => {
		setActionError('');
		setIsUpdating(true);

		const isCreateMode = !editingUser;

		try {
			if (isCreateMode) {
				// Create new user
				const createData: ICreateUserRequest = {
					username: userData.username!,
					email: userData.email!,
					password: userData.password!,
					role: userData.role,
				};
				await createUser(createData);

				handleCloseModal();
				handleUserRefresh(); // Refresh user list
				openPopUp(t('Success'), t('User "{{username}}" has been created successfully', {username: userData.username}), t('OK'));
			} else {
				// Update existing user
				const originalUsername = editingUser.username;
				const usernameChanged = userData.username !== originalUsername;
				const isCurrentUserUpdate = editingUser.id === my_info?.id;

				await updateUser(editingUser.id, userData);

				// A self-edit changes the identity the whole app renders from
				// (`my_info`), but updateUser touches no cache — without this the
				// header profile menu and the Profile tab keep the stale email
				// until the 5s staleTime lapses (stale-menu-cache regression).
				if (isCurrentUserUpdate) {
					await queryClient.invalidateQueries({queryKey: ['my_info']});
				}

				// If current user changed their username, we need to re-login to get new token
				if (isCurrentUserUpdate && usernameChanged) {
					// Check if user provided a password (either new or current)
					if (userData.password) {
						try {
							// Re-login with new username and provided password.
							// login_user resolves to an OpResult (UI-P6-1) —
							// re-enter the existing catch flow on any
							// non-confirmed outcome, with a localized message.
							const loginResult = await login_user({
								username: userData.username!,
								password: userData.password!
							});
							if (loginResult.status !== 'confirmed' || !loginResult.data?.token) {
								throw new Error(t(loginResult.localeKey));
							}

							// Update the access token
							save_local_storage('access_token', loginResult.data.token);

							handleCloseModal();
							handleUserRefresh(); // Refresh user list
							openPopUp(
								t('Success'),
								t('Username and authentication updated successfully. You are now logged in with your new username.'),
								t('OK')
							);
							return;
						} catch (reloginError) {
							// eslint-disable-next-line no-console -- deliberate operator-visible log on a failure/edge path; listed in the expected-console-message catalogue
							console.error('Re-login failed:', reloginError);
							// If re-login fails, force logout and redirect
							handleCloseModal();
							// persistent: the session is already invalid — dismissing this
							// dialog without the forced relogin would strand a dead session.
							openPopUp(
								t('Authentication Error'),
								t('Username was updated but re-login failed. Please log in again with your new credentials.'),
								t('OK'),
								'',
								() => {
									localStorage.removeItem('access_token');
									move_forced('/login');
								},
								undefined,
								{persistent: true}
							);
							return;
						}
					} else {
						// No password provided - user needs to log in manually
						handleCloseModal();
						// persistent: same forced-relogin shape as above.
						openPopUp(
							t('Username Updated'),
							t('Your username has been updated. Please log in again with your new username to continue.'),
							t('OK'),
							'',
							() => {
								localStorage.removeItem('access_token');
								move_forced('/login');
							},
							undefined,
							{persistent: true}
						);
						return;
					}
				}

				handleCloseModal();
				handleUserRefresh(); // Refresh user list
				// Show success popup (same pattern as LBRulePage)
				openPopUp(t('Success'), t('User "{{username}}" has been updated successfully', {username: userData.username}), t('OK'));
			}
		} catch (error: any) {
			const errorMessage = error?.message || (isCreateMode ? t('Failed to create user') : t('Failed to update user'));
			setActionError(errorMessage);
			throw new Error(errorMessage);
		} finally {
			setIsUpdating(false);
		}
	};

	const a11yProps = (index: number) => {
		return {
			id: `user-tab-${index}`,
			'aria-controls': `user-tabpanel-${index}`,
		};
	};

	return (
		<>
			<ScrollableBox>
				<Stack position="relative" id="fixed-container" width="100%" height="100%" spacing={3} padding="16px">
					<Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
						<Tabs 
							value={tabValue} 
							onChange={handleTabChange} 
							aria-label="user management tabs"
							sx={{
								'& .MuiTab-root': {
									textTransform: 'none',
									minWidth: 120,
									fontSize: '14px',
								},
							}}
						>
							<Tab 
								icon={<PersonIcon fontSize="small" />}
								iconPosition="start"
								label={t('Profile')} 
								{...a11yProps(0)} 
							/>
							{/* <Tab 
								icon={<LockIcon fontSize="small" />}
								iconPosition="start"
								label={t('Security')} 
								{...a11yProps(1)} 
							/> */}
							{isAdmin && (
								<Tab 
									icon={<AdminPanelSettingsIcon fontSize="small" />}
									iconPosition="start"
									label={t('User List')} 
									{...a11yProps(1)}
								/>
							)}
						</Tabs>
					</Box>

					<TabPanel value={tabValue} index={0}>
						<UserProfilePanel onEditProfile={handleEditProfile} />
					</TabPanel>

					{/* <TabPanel value={tabValue} index={1}>
						<PasswordManagementPanel />
					</TabPanel> */}

					{isAdmin && (
						<TabPanel value={tabValue} index={1}>
							<AdminUserManagementPanel
								onRefresh={handleUserRefresh}
								refetchRef={userRefetchRef}
								currentUser={my_info}
								onEditUser={handleEditUser}
								onAddUser={handleAddUser}
							/>
						</TabPanel>
					)}
				</Stack>
			</ScrollableBox>

			<UserEditModal
				open={editModalOpen}
				user={editingUser}
				onClose={handleCloseModal}
				onSubmit={handleSubmitUser}
				loading={isUpdating}
				error={actionError}
				isAdmin={isAdmin}
				currentUserId={my_info?.id}
				mode={editingUser ? 'edit' : 'create'}
			/>

		</>
	);
}