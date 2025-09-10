//---------------------------------------------------------
// License Update Modal Component
//---------------------------------------------------------
import {Box, Modal, Paper, Button, Stack, Alert, CircularProgress} from '@mui/material';
import {useState, useCallback} from 'react';
import LicenseUpdateForm from 'components/input/LicenseUpdateForm';
import {IUpdateLicenseRequest} from 'types/license';
import {t} from 'i18next';

//---------------------------------------------------------
// Component Props Interface
//---------------------------------------------------------
interface LicenseUpdateModalProps {
	open: boolean;
	onClose: () => void;
	onSubmit: (licenseData: IUpdateLicenseRequest) => Promise<void>;
	loading: boolean;
	error: string;
	mode: 'install' | 'update' | 'upgrade';
}

//---------------------------------------------------------
// Component Implementation
//---------------------------------------------------------
export default function LicenseUpdateModal(props: LicenseUpdateModalProps) {
	const {open, onClose, onSubmit, loading, error, mode} = props;
	const [formData, setFormData] = useState<IUpdateLicenseRequest | null>(null);
	const [isFormValid, setIsFormValid] = useState(false);

	const handleFormChange = useCallback((data: IUpdateLicenseRequest & { isValid?: boolean; errors?: any }) => {
		setFormData(data);
	}, []);

	const handleFormValidation = useCallback((isValid: boolean) => {
		setIsFormValid(isValid);
	}, []);

	const handleSubmit = async () => {
		if (!formData || !isFormValid) return;
		
		try {
			await onSubmit(formData);
		} catch (error) {
			// Error is already handled by parent component
			console.error('License update failed:', error);
		}
	};

	const getModeConfig = () => {
		switch (mode) {
			case 'install':
				return {
					buttonText: t('Install'),
					color: 'primary' as const
				};
			case 'upgrade':
				return {
					buttonText: t('Upgrade'),
					color: 'secondary' as const
				};
			case 'update':
			default:
				return {
					buttonText: t('Update'),
					color: 'primary' as const
				};
		}
	};

	const config = getModeConfig();

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
						<LicenseUpdateForm
							onChange={handleFormChange}
							onValidation={handleFormValidation}
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
								variant="outlined"
								onClick={onClose}
								disabled={loading}
								sx={{ minWidth: 100 }}
							>
								{t('Cancel')}
							</Button>
							<Button
								variant="contained"
								color={config.color}
								onClick={handleSubmit}
								disabled={!isFormValid || loading}
								startIcon={loading ? <CircularProgress size={16} /> : undefined}
								sx={{ minWidth: 120 }}
							>
								{loading ? t('Processing...') : config.buttonText}
							</Button>
						</Stack>
					</Stack>
				</Box>
			</Paper>
		</Modal>
	);
}
