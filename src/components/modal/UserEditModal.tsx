//---------------------------------------------------------
// User Edit Modal Component
//---------------------------------------------------------
import {Box, Modal, Paper, Button, Stack, Alert, CircularProgress} from '@mui/material';
import {useState, useCallback} from 'react';
import UserEditForm from 'components/input/UserEditForm';
import {IUser} from 'types/oam';
import {IUserUpdateRequest} from 'types/user';
import {t} from 'i18next';

//---------------------------------------------------------
// Component Props Interface
//---------------------------------------------------------
interface UserEditModalProps {
	open: boolean;
	user?: IUser | null;
	onClose: () => void;
	onSubmit: (userData: IUserUpdateRequest) => Promise<void>;
	loading: boolean;
	error: string;
	isAdmin?: boolean;
	currentUserId?: number;
	mode?: 'edit' | 'create'; // Add mode prop
}

//---------------------------------------------------------
// Component Implementation
//---------------------------------------------------------
export default function UserEditModal(props: UserEditModalProps) {
	const {open, user, onClose, onSubmit, loading, error, isAdmin = false, currentUserId, mode = 'edit'} = props;
	const [formData, setFormData] = useState<IUserUpdateRequest | null>(null);
	const [isFormValid, setIsFormValid] = useState(false);

	const isCreateMode = mode === 'create';

	const handleFormChange = useCallback((data: IUserUpdateRequest & { isValid?: boolean; errors?: any }) => {
		setFormData(data);
	}, []);

	const handleFormValidation = useCallback((isValid: boolean) => {
		setIsFormValid(isValid);
	}, []);

	// For create mode, user is optional; for edit mode, return null if no user
	if (!isCreateMode && !user) return null;

	const isCurrentUser = Boolean(!isCreateMode && user && user.id === currentUserId);

	const handleSubmit = async () => {
		if (!formData || !isFormValid) return;
		
		const updateData: IUserUpdateRequest = {
			username: formData.username,
			email: formData.email,
		};

		// Send `role` only when it can legitimately change: creating a user, or an
		// admin editing someone else. For a self-edit (any role, incl. admin) omit
		// it — the server rejects a non-admin update whose body carries a role
		// field, breaking self-service profile edits.
		if (isCreateMode || (isAdmin && !isCurrentUser)) {
			updateData.role = formData.role;
		}

		// Only include password if it's provided
		if (formData.password && formData.password.trim()) {
			updateData.password = formData.password;
		}

		try {
			await onSubmit(updateData);
		} catch (error) {
			// Error is already handled by parent component (UserManagementPage)
			// Just need to prevent the error from bubbling up further
			console.error('User update failed:', error);
		}
	};

	const style = {
		position: 'absolute',
		top: '50%',
		left: '50%',
		transform: 'translate(-50%, -50%)',
		width: '90%',
		maxWidth: '520px',
		maxHeight: '90vh',
		overflow: 'auto',
		borderRadius: '8px',
		boxShadow: 24,
		p: 0,
	};

	return (
		<Modal open={open} onClose={onClose}>
			<Paper sx={style}>
				<Box p={3}>
					<Stack spacing={3}>
						<UserEditForm
							user={user || undefined}
							onChange={handleFormChange}
							onValidation={handleFormValidation}
							isAdmin={isAdmin}
							isCurrentUser={isCurrentUser}
							mode={mode}
						/>

						{error && (
							<Alert severity="error">
								{error}
							</Alert>
						)}

						<Stack
							direction="row"
							spacing={2}
							justifyContent="flex-end"
							sx={{ mt: 1, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}
						>
							<Button
								variant="contained"
								color="primary"
								onClick={onClose}
								disabled={loading}
								sx={{ minWidth: 100 }}
							>
								{t('Cancel')}
							</Button>
							<Button
								variant="contained"
								color="secondary"
								onClick={handleSubmit}
								disabled={!isFormValid || loading}
								startIcon={loading ? <CircularProgress size={16} /> : undefined}
								sx={{ minWidth: 120 }}
							>
								{loading
									? (isCreateMode ? t('Creating...') : t('Updating...'))
									: (isCreateMode ? t('Create User') : t('Update User'))
								}
							</Button>
						</Stack>
					</Stack>
				</Box>
			</Paper>
		</Modal>
	);
}