//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import LicenseIcon from '@mui/icons-material/CardMembership';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import EditIcon from '@mui/icons-material/Edit';
import {Box, Stack, Typography, Tabs, Tab, Button} from '@mui/material';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import ScrollableBox from 'components/layout/ScrollableBox';
import UserManagementTable from 'components/table/managers/UserManagementTable';
import UserEditModal from 'components/modal/UserEditModal';
import {useMyInfo} from 'hooks/query/oamHooks';
import {useUserLicenses} from 'hooks/query/licenseHooks';
import {useAllUsers, updateUser, deleteUser, createUser} from 'hooks/query/userManagementHooks';
import {usePopUp} from 'hooks/popupHook';
import {login_user} from 'connector/user';
import {save_local_storage, move_forced} from 'common';
import {t} from 'i18next';
import {Fragment, useState, useMemo, useEffect, useCallback, useRef} from 'react';
import {getStableHash} from 'common';
import {updateUserLicense, deactivateUserLicense, installLicense} from 'hooks/query/licenseHooks';
import LicenseManagementTable from 'components/table/managers/LicenseManagementTable';
import LicenseUpdateForm from 'components/input/LicenseUpdateForm';
import {IUser} from 'types/oam';
import {IUserUpdateRequest, ICreateUserRequest} from 'types/user';
import {IUpdateLicenseRequest, IInstallLicenseRequest} from 'types/license';

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
// License Management Panel
//---------------------------------------------------------
function LicenseManagementPanel() {
	const {userLicenses, refetch, isLoading} = useUserLicenses();

	const {openPopUp} = usePopUp();
	
	const [selectedRows, setSelectedRows] = useState<number[]>([]);
	const [selectedKey, setSelectedKey] = useState<string | null>(null);


	const licenseInfo = useMemo(() => ({licenses: userLicenses?.licenses ?? []}), [userLicenses]);

	// Hash function for license
	const getHashKey = (item: any) => {
		const str = `${item.id || ''}_${item.license_type || ''}_${item.license_key_hash || ''}`;
		return getStableHash(str);
	};

	// Sorted licenses
	const sortedLicenses = licenseInfo.licenses ? [...licenseInfo.licenses].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];

	// Find selected index in sortedLicenses
	let selectedIndex = -1;
	if (selectedRows.length === 1 && licenseInfo.licenses) {
		const original = licenseInfo.licenses[selectedRows[0]];
		selectedIndex = sortedLicenses.findIndex(license => getHashKey(license) === getHashKey(original));
	} else if (selectedKey) {
		selectedIndex = sortedLicenses.findIndex(license => getHashKey(license).toString() === selectedKey);
	}

	// Selection handler: map sorted index back to original
	const handleSelectionChange = (indices: number[]) => {
		if (indices.length === 1 && licenseInfo.licenses) {
			const sortedItem = sortedLicenses[indices[0]];
			const originalIndex = licenseInfo.licenses.findIndex(license => getHashKey(license) === getHashKey(sortedItem));
			setSelectedRows(originalIndex !== -1 ? [originalIndex] : []);
		} else {
			setSelectedRows([]);
		}
	};

	useEffect(() => {
		if (!licenseInfo || licenseInfo.licenses.length === 0) return;
		if (selectedRows.length === 1) {
			const item = licenseInfo.licenses[selectedRows[0]];
			setSelectedKey(getHashKey(item).toString());
		} else if (selectedKey !== null) {
			setSelectedKey(null);
		}
	}, [licenseInfo, selectedRows, selectedKey]);

	const handleDelete = useCallback(async () => {
		if (selectedRows.length !== 1) return;

		const licenseId = licenseInfo.licenses[selectedRows[0]].id;

		openPopUp(
			t('Confirm Delete'),
			t('Are you sure you want to deactivate this license? This action cannot be undone.'),
			t('Delete'),
			t('Cancel'),
			async () => {
				try {
					await deactivateUserLicense(licenseId);
					openPopUp(t('Success'), t('License deactivated successfully.'), t('OK'));
					setSelectedRows([]);
					setTimeout(() => {
						refetch();
					}, 1000);
				} catch (error: any) {
					openPopUp(t('Error'), t('Failed to deactivate license. {{error}}', {error: error?.message || error}), t('OK'));
				}
			}
		);
	}, [selectedRows, licenseInfo, openPopUp, refetch]);

	const licenseFormRef = useRef<IInstallLicenseRequest | null>(null);
	const [isFormValid, setIsFormValid] = useState(false);
	
	const handleAdd = useCallback(() => {
		setIsFormValid(false); // Reset validation state
		licenseFormRef.current = null; // Reset form data
		
		const inputForm = (
			<LicenseUpdateForm
				key={Date.now()}
				onChange={(data: IUpdateLicenseRequest & { isValid?: boolean; errors?: any }) => {
					licenseFormRef.current = data as IInstallLicenseRequest;
				}}
				onValidation={(isValid: boolean) => {
					setIsFormValid(isValid);
				}}
				mode="install"
			/>
		);

		openPopUp(
			'',
			inputForm,
			t('Install'),
			t('Cancel'),
			async () => {
				if (!licenseFormRef.current) return;

				try {
					await installLicense(licenseFormRef.current!);
					openPopUp(t('Success'), t('License installed successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} catch (error: any) {
					openPopUp(t('Error'), t('Failed to install license. {{error}}', {error: error?.message || error}), t('OK'));
				}
			},
			isFormValid
		);
	}, [openPopUp, refetch, isFormValid]);

	const updateFormRef = useRef<IUpdateLicenseRequest | null>(null);
	const [isUpdateFormValid, setIsUpdateFormValid] = useState(false);
	
	const handleUpdate = useCallback(() => {
		if (selectedRows.length !== 1) return;

		const selectedLicense = licenseInfo.licenses[selectedRows[0]];
		setIsUpdateFormValid(false); // Reset validation state
		updateFormRef.current = null; // Reset form data

		const updateForm = (
			<LicenseUpdateForm
				key={Date.now()}
				onChange={(data: IUpdateLicenseRequest & { isValid?: boolean; errors?: any }) => {
					updateFormRef.current = data;
				}}
				onValidation={(isValid: boolean) => {
					setIsUpdateFormValid(isValid);
				}}
				mode="update"
			/>
		);

		openPopUp(
			'',
			updateForm,
			t('Update'),
			t('Cancel'),
			async () => {
				if (!updateFormRef.current) return;

				try {
					await updateUserLicense(selectedLicense.id, updateFormRef.current!);
					openPopUp(t('Success'), t('License updated successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} catch (error: any) {
					openPopUp(t('Error'), t('Failed to update license. {{error}}', {error: error?.message || error}), t('OK'));
				}
			},
			isUpdateFormValid
		);
	}, [selectedRows, licenseInfo, openPopUp, refetch, isUpdateFormValid]);

	if (isLoading) {
		return (
			<Stack spacing={3}>
				<Typography variant="h6" display="flex" alignItems="center" gap={1}>
					<LicenseIcon />
					{t('License Management')}
				</Typography>
				<Typography variant="body2" color="text.secondary">
					{t('Loading license information...')}
				</Typography>
			</Stack>
		);
	}

	return licenseInfo ? (
		<Fragment>
			<LicenseManagementTable
				data={{licenses: sortedLicenses}}
				selected_rows={selectedIndex !== -1 ? [selectedIndex] : []}
				onChangeSelectedRows={handleSelectionChange}
				onAdd={handleAdd}
				onDelete={handleDelete}
				onUpdate={handleUpdate}
				onRefresh={refetch}
			/>
		</Fragment>
	) : null;
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
	const {users, isLoading, refetch} = useAllUsers();

	const {openPopUp} = usePopUp();
	const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

	// Expose refetch function to parent via ref
	useEffect(() => {
		if (refetchRef) {
			refetchRef.current = refetch;
		}
	}, [refetch, refetchRef]);

	const handleDeleteUser = () => {
		if (selectedUsers.length === 0) return;

		const selectedUserData = selectedUsers.map(index => users[index]).filter(Boolean);
		const usernames = selectedUserData.map(user => user.username).join(', ');

		openPopUp(
			t('Confirm Delete'),
			t('Are you sure you want to delete user(s): "' + usernames + '"? This action cannot be undone.'),
			t('Delete'),
			t('Cancel'),
			async () => {
				try {
					// Delete all selected users
					await Promise.all(selectedUserData.map(user => deleteUser(user.id)));
					setSelectedUsers([]);
					// Refresh the user list
					onRefresh();
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : t('Failed to delete one or more users');
					openPopUp(t('Error'), errorMessage, t('OK'));
				}
			}
		);
	};

	const handleEditUser = () => {
		if (selectedUsers.length !== 1) return;
		const selectedUser = users[selectedUsers[0]];
		if (selectedUser) {
			onEditUser(selectedUser);
		}
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
					data={{users}}
					selected_rows={selectedUsers}
					onChangeSelectedRows={setSelectedUsers}
					onAdd={onAddUser}
					onUpdate={handleEditUser}
					onDelete={handleDeleteUser}
					onRefresh={onRefresh}
					currentUserId={currentUser?.id}
					isAdmin={currentUser?.role === 'admin'}
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

				// If current user changed their username, we need to re-login to get new token
				if (isCurrentUserUpdate && usernameChanged) {
					// Check if user provided a password (either new or current)
					if (userData.password) {
						try {
							// Re-login with new username and provided password
							const loginResult = await login_user({
								username: userData.username!,
								password: userData.password!
							});

							// Update the access token
							save_local_storage('access_token', loginResult.token);

							handleCloseModal();
							handleUserRefresh(); // Refresh user list
							openPopUp(
								t('Success'),
								t('Username and authentication updated successfully. You are now logged in with your new username.'),
								t('OK')
							);
							return;
						} catch (reloginError) {
							console.error('Re-login failed:', reloginError);
							// If re-login fails, force logout and redirect
							handleCloseModal();
							openPopUp(
								t('Authentication Error'),
								t('Username was updated but re-login failed. Please log in again with your new credentials.'),
								t('OK'),
								'',
								() => {
									localStorage.removeItem('access_token');
									move_forced('/login');
								}
							);
							return;
						}
					} else {
						// No password provided - user needs to log in manually
						handleCloseModal();
						openPopUp(
							t('Username Updated'),
							t('Your username has been updated. Please log in again with your new username to continue.'),
							t('OK'),
							'',
							() => {
								localStorage.removeItem('access_token');
								move_forced('/login');
							}
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
							<Tab 
								icon={<LicenseIcon fontSize="small" />}
								iconPosition="start"
								label={t('License')} 
								{...a11yProps(2)} 
							/>
							{isAdmin && (
								<Tab 
									icon={<AdminPanelSettingsIcon fontSize="small" />}
									iconPosition="start"
									label={t('User List')} 
									{...a11yProps(3)} 
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

					<TabPanel value={tabValue} index={1}>
						<LicenseManagementPanel />
					</TabPanel>

					{isAdmin && (
						<TabPanel value={tabValue} index={2}>
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