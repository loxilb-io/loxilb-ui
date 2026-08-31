//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Button, Modal, Stack, Typography} from '@mui/material';
import {useTranslation} from 'react-i18next';

//---------------------------------------------------------
// Types
//---------------------------------------------------------
interface ErrorPopUpProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	mainMessage: string;
	errorData: any;
	buttonText?: string;
}

interface ParsedError {
	primary: string;
	secondary: string;
	code: string;
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ErrorPopUp({ 
	isOpen, 
	onClose, 
	title, 
	mainMessage, 
	errorData, 
	buttonText = 'OK' 
}: ErrorPopUpProps) {
	useTranslation();

	const style = {
		position: 'absolute',
		top: '50%',
		left: '50%',
		transform: 'translate(-50%, -50%)',
		width: '500px',
		maxWidth: '90%',
		borderRadius: '8px',
		boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
		padding: '24px',
		bgcolor: 'background.paper',
	};

	// Parse error data into structured format
	const parseErrorData = () => {
		let mainError = 'An unexpected error occurred';
		let errorCode = '';
		let additionalDetails = '';
		
		if (typeof errorData === 'object' && errorData !== null) {
			mainError = errorData.message || errorData.Message || mainError;
			if (errorData.code || errorData.Code) {
				errorCode = errorData.code || errorData.Code;
			}
			if (errorData.details || errorData.Details) {
				additionalDetails = errorData.details || errorData.Details;
			}
		} else if (typeof errorData === 'string') {
			mainError = errorData;
		}
		
		// Parse complex error messages into readable parts
		const parseErrorMessage = (message: string): ParsedError => {
			let primary = message;
			let secondary = '';
			let code = errorCode;
			
			// Extract error code from message
			if (message.includes('Error Code:')) {
				const parts = message.split('Error Code:');
				primary = parts[0].trim();
				const codeStr = parts[1].trim();
				const codeMatch = codeStr.match(/\d+/);
				if (codeMatch) {
					code = codeMatch[0];
				}
			}
			
			// Split on common separators
			if (primary.includes(' OR ')) {
				const orParts = primary.split(' OR ');
				primary = orParts[0].trim();
				secondary = orParts[1].trim();
			} else if (primary.includes(': ')) {
				const colonParts = primary.split(': ');
				if (colonParts.length > 1) {
					primary = colonParts[0].trim();
					secondary = colonParts.slice(1).join(': ').trim();
				}
			}
			
			return { primary, secondary, code };
		};
		
		const parsed = parseErrorMessage(mainError);
		
		return {
			primary: parsed.primary,
			secondary: parsed.secondary,
			code: parsed.code,
			additionalDetails
		};
	};

	const { primary, secondary, code, additionalDetails } = parseErrorData();

	const handleClose = () => {
		onClose();
	};

	return (
		<Modal open={isOpen} onClose={handleClose}>
			<Box sx={style}>
				<Stack spacing={3}>
					{/* Header with icon */}
					<Box display="flex" alignItems="center" gap="12px">
						<span style={{ fontSize: '24px' }}>⚠️</span>
						<Typography 
							variant="h6" 
							component="h2" 
							style={{ 
								color: '#d32f2f',
								fontWeight: '600',
								margin: 0
							}}
						>
							{title}
						</Typography>
					</Box>

					{/* Error content */}
					<Box sx={{ minHeight: '40px' }}>
						<div style={{ textAlign: 'left' }}>
							{/* Main message */}
							<div style={{ marginBottom: '12px', fontWeight: '500' }}>
								{mainMessage}
							</div>
							
							{/* Primary error */}
							<div style={{ marginBottom: '8px', color: '#d32f2f', lineHeight: '1.5' }}>
								{primary}
							</div>
							
							{/* Secondary error details */}
							{secondary && (
								<div style={{ 
									marginBottom: '8px', 
									color: '#e57373', 
									fontSize: '0.9rem',
									lineHeight: '1.4'
								}}>
									{secondary}
								</div>
							)}
							
							{/* Error code and additional details box */}
							{(code || additionalDetails) && (
								<div style={{ 
									fontSize: '0.875rem', 
									color: '#666', 
									backgroundColor: '#f5f5f5', 
									padding: '12px', 
									borderRadius: '4px',
									border: '1px solid #e0e0e0'
								}}>
									{code && (
										<div style={{ marginBottom: additionalDetails ? '8px' : '0', fontWeight: '500' }}>
											Error Code: {code}
										</div>
									)}
									{additionalDetails && (
										<div style={{ whiteSpace: 'pre-line' }}>
											Details: {additionalDetails}
										</div>
									)}
								</div>
							)}
						</div>
					</Box>

					{/* Button */}
					<Box display="flex" justifyContent="flex-end" paddingTop="8px">
						<Box width="100px">
							<Button 
								fullWidth 
								variant="contained" 
								onClick={handleClose}
								sx={{
									height: '40px',
									textTransform: 'none',
									fontWeight: '500',
									backgroundColor: '#d32f2f',
									'&:hover': {
										backgroundColor: '#b71c1c',
									}
								}}
							>
								{buttonText}
							</Button>
						</Box>
					</Box>
				</Stack>
			</Box>
		</Modal>
	);
}