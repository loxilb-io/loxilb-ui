//---------------------------------------------------------
// useErrorPopup Hook - Reusable error handling with formatted popup
//---------------------------------------------------------
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

//---------------------------------------------------------
// Types
//---------------------------------------------------------
interface ErrorPopupState {
	isOpen: boolean;
	title: string;
	mainMessage: string;
	errorData: any;
}

//---------------------------------------------------------
// Hook
//---------------------------------------------------------
export function useErrorPopup() {
	const { t } = useTranslation();
	
	const [errorPopup, setErrorPopup] = useState<ErrorPopupState>({
		isOpen: false,
		title: '',
		mainMessage: '',
		errorData: null
	});

	// Show formatted error popup
	const showErrorPopup = useCallback((mainMessage: string, errorData: any) => {
		setErrorPopup({
			isOpen: true,
			title: t('Error'),
			mainMessage,
			errorData
		});
	}, [t]);

	// Close error popup
	const closeErrorPopup = useCallback(() => {
		setErrorPopup(prev => ({ ...prev, isOpen: false }));
	}, []);

	// Common error messages for different operations
	const showCreateError = useCallback((resourceType: string, errorData: any) => {
		showErrorPopup(t('Failed to create {{resourceType}}.', { resourceType }), errorData);
	}, [showErrorPopup, t]);

	const showUpdateError = useCallback((resourceType: string, errorData: any) => {
		showErrorPopup(t('Failed to update {{resourceType}}.', { resourceType }), errorData);
	}, [showErrorPopup, t]);

	const showDeleteError = useCallback((resourceType: string, errorData: any) => {
		showErrorPopup(t('Failed to delete {{resourceType}}.', { resourceType }), errorData);
	}, [showErrorPopup, t]);

	const showAddError = useCallback((resourceType: string, errorData: any) => {
		showErrorPopup(t('Failed to add {{resourceType}}.', { resourceType }), errorData);
	}, [showErrorPopup, t]);

	return {
		// State
		errorPopup,
		
		// Basic functions
		showErrorPopup,
		closeErrorPopup,
		
		// Convenience functions for common operations
		showCreateError,
		showUpdateError,
		showDeleteError,
		showAddError
	};
}