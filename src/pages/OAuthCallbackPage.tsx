//---------------------------------------------------------
// OAuth Callback Page Component
//---------------------------------------------------------
import { Box, CircularProgress, Typography, Alert, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import { t } from 'i18next';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	is_oauth_callback,
	get_oauth_callback_params,
	get_oauth_provider_from_state,
	oauth_handle_callback,
} from 'connector/oauth';
import { save_local_storage, move_forced } from 'common';
import { OAuthProvider } from 'types/user';

//---------------------------------------------------------
// Styled Components
//---------------------------------------------------------
const CallbackContainer = styled(Box)(({ theme }) => ({
	width: '100%',
	height: '100vh',
	display: 'flex',
	flexDirection: 'column',
	justifyContent: 'center',
	alignItems: 'center',
	backgroundColor: '#f5f5f5',
	padding: theme.spacing(3),
}));

const StatusBox = styled(Box)(({ theme }) => ({
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	backgroundColor: 'white',
	padding: theme.spacing(4),
	borderRadius: theme.spacing(2),
	boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
	maxWidth: '400px',
	width: '100%',
}));

//---------------------------------------------------------
// Component Implementation
//---------------------------------------------------------
export default function OAuthCallbackPage() {
	const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
	const [error, setError] = useState<string>('');
	const [provider, setProvider] = useState<OAuthProvider | null>(null);
	const navigate = useNavigate();

	useEffect(() => {
		const handleCallback = async () => {
			try {
				// Check if we're in a popup window
				const isPopup = window.opener && window.opener !== window;
				console.log('OAuth callback - isPopup:', isPopup);
				
				// Add delay to let page content load
				await new Promise(resolve => setTimeout(resolve, 1000));
				
				// Get page content to check for JSON response
				const pageText = document.body.innerText || document.body.textContent || '';
				console.log('Page content:', pageText);
				
				// Check if this page contains a JSON response with token
				if (pageText.includes('"token"') && pageText.includes('"id"')) {
					console.log('Found JSON token response');
					const tokenMatch = pageText.match(/"token":"([^"]+)"/);
					if (tokenMatch && tokenMatch[1]) {
						const token = tokenMatch[1];
						console.log('Extracted token:', token.substring(0, 20) + '...');
						
						if (isPopup) {
							// In popup - store token and close
							sessionStorage.setItem('oauth_temp_token', token);
							setStatus('success');
							setProvider(sessionStorage.getItem('oauth_provider') as OAuthProvider);
							setTimeout(() => {
								window.close();
							}, 1000);
						} else {
							// Not in popup - redirect directly
							save_local_storage('access_token', token);
							setStatus('success');
							setTimeout(() => {
								move_forced('/instance');
							}, 1500);
						}
						return;
					}
				}
				
				// Fallback: traditional OAuth callback handling
				if (is_oauth_callback()) {
					console.log('Traditional OAuth callback detected');
					const callbackParams = get_oauth_callback_params();
					if (!callbackParams) {
						throw new Error('Failed to parse OAuth callback parameters');
					}

					if (callbackParams.error) {
						throw new Error(callbackParams.error_description || callbackParams.error);
					}

					const oauthProvider = get_oauth_provider_from_state(callbackParams.state);
					if (!oauthProvider) {
						throw new Error('Invalid OAuth state. Unable to determine provider.');
					}

					setProvider(oauthProvider);

					const result = await oauth_handle_callback(oauthProvider, callbackParams);
					
					if (isPopup) {
						sessionStorage.setItem('oauth_temp_token', result.token);
						setStatus('success');
						setTimeout(() => {
							window.close();
						}, 1000);
					} else {
						save_local_storage('access_token', result.token);
						setStatus('success');
						setTimeout(() => {
							move_forced('/instance');
						}, 1500);
					}
					return;
				}
				
				// No valid OAuth data found
				setStatus('error');
				setError('No valid OAuth authentication data found');
				
			} catch (err) {
				console.error('OAuth callback error:', err);
				setStatus('error');
				setError(err instanceof Error ? err.message : t('Authentication failed. Please try again.'));
			}
		};

		handleCallback();
	}, []);

	const handleReturnToLogin = () => {
		if (window.opener) {
			window.close();
		} else {
			navigate('/');
		}
	};

	const renderContent = () => {
		switch (status) {
			case 'loading':
				return (
					<>
						<CircularProgress size={48} sx={{ mb: 3 }} />
						<Typography variant="h6" gutterBottom>
							{t('Processing Authentication...')}
						</Typography>
						<Typography variant="body2" color="text.secondary" align="center">
							{provider 
								? t('Completing {{provider}} authentication', { provider: provider })
								: t('Processing OAuth authentication')}
						</Typography>
					</>
				);

			case 'success':
				return (
					<>
						<Box
							sx={{
								width: 48,
								height: 48,
								backgroundColor: 'success.main',
								borderRadius: '50%',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								mb: 3,
							}}
						>
							<Typography variant="h4" color="white">
								✓
							</Typography>
						</Box>
						<Typography variant="h6" gutterBottom color="success.main">
							{t('Authentication Successful!')}
						</Typography>
						<Typography variant="body2" color="text.secondary" align="center">
							{window.opener 
								? t('Closing window...')
								: t('Redirecting to application...')}
						</Typography>
					</>
				);

			case 'error':
				return (
					<>
						<Alert severity="error" sx={{ width: '100%', mb: 3 }}>
							{error}
						</Alert>
						<Typography variant="h6" gutterBottom color="error">
							{t('Authentication Failed')}
						</Typography>
						<Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
							{t('OAuth authentication failed. Please try again.')}
						</Typography>
						<Button
							variant="contained"
							onClick={handleReturnToLogin}
							sx={{ mt: 2 }}
						>
							{window.opener ? t('Close Window') : t('Return to Login')}
						</Button>
					</>
				);

			default:
				return null;
		}
	};

	return (
		<CallbackContainer>
			<StatusBox>
				{renderContent()}
			</StatusBox>
		</CallbackContainer>
	);
}