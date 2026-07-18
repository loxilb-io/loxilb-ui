//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert, AlertTitle, Box, Button, Stack} from '@mui/material';
import {t} from 'i18next';
import React, {Component, ErrorInfo, ReactNode} from 'react';

//---------------------------------------------------------
// Route-level Error Boundary
//
// A single page component that throws during render (e.g. feeding a gateway
// 402 error body into a list renderer) must NOT unmount the whole app shell.
// This boundary wraps the routed <Outlet/> so a page throw shows a contained
// fallback while the header / side-nav stay alive. Keyed by route so navigating
// away resets it.
//---------------------------------------------------------
interface Props {
	children: ReactNode;
	// A value that changes on navigation; when it changes the boundary resets so
	// a previously-crashed route does not stay stuck on the fallback.
	resetKey?: string;
}

interface State {
	error: Error | null;
}

export default class RouteErrorBoundary extends Component<Props, State> {
	state: State = {error: null};

	static getDerivedStateFromError(error: Error): State {
		return {error};
	}

	componentDidUpdate(prevProps: Props) {
		if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
			this.setState({error: null});
		}
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		// Keep a console trace for developers; the fallback keeps the app usable.
		console.error('Route render error:', error, info.componentStack);
	}

	render() {
		if (this.state.error) {
			return (
				<Box sx={{p: 3}}>
					<Alert severity="error">
						<AlertTitle>{t('This page could not be displayed')}</AlertTitle>
						<Stack spacing={2} alignItems="flex-start">
							<span>{t('An unexpected error occurred while rendering this page. The rest of the console remains available.')}</span>
							<Button variant="outlined" size="small" onClick={() => this.setState({error: null})}>
								{t('Retry')}
							</Button>
						</Stack>
					</Alert>
				</Box>
			);
		}

		return this.props.children;
	}
}
