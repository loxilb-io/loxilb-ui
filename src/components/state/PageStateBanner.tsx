//---------------------------------------------------------
// PageStateBanner — the one place a page state becomes words 
//---------------------------------------------------------
// Shared by QueryStateGate and by DataTable's `state` prop, so a table and a
// dashboard card describe the same situation identically.
//
// Two rules this component exists to keep:
//   1. Raw server prose never reaches the screen. Every message comes from the
// catalogue; OpResult.rawDetail stays diagnostics-only.
// 2. A state flip is announced, not silently repainted. Benign
//      states are role="status" / aria-live="polite"; a hard failure is
//      role="alert", which interrupts.

import {Alert, AlertTitle, Box, Button} from '@mui/material';
import {useTranslation} from 'react-i18next';
import {STATUS_LOCALE_KEYS} from 'connector/fetcher/opResultCodes';
import {OpResult} from 'connector/fetcher/opResult';
import {PageDataState} from './pageState';

export interface PageStateBannerProps {
	state: PageDataState<unknown>;
	/** Localized resource name, e.g. t('Load Balancer Rule'). */
	name: string;
	onRetry?: () => void;
	/** Overrides the default empty-state sentence. */
	emptyMessage?: string;
}

/**
 * The OpResult's own locale key, but only when it says more than the generic
 * default for its status. 429 (rate limited) and 501 (feature not enabled)
 * carry a specific message worth showing; a plain 503 would otherwise repeat
 * the headline underneath itself.
 */
function specificDetail(result: OpResult): string | undefined {
	return result.localeKey === STATUS_LOCALE_KEYS[result.status] ? undefined : result.localeKey;
}

export default function PageStateBanner({state, name, onRetry, emptyMessage}: PageStateBannerProps) {
	const {t} = useTranslation();

	// Nothing to say: the rows on screen are current, or there is nothing on
	// screen yet (the gate renders its own busy indicator for that).
	if (state.kind === 'data' || state.kind === 'loading') return null;

	const retry = onRetry ? (
		<Button color="inherit" size="small" onClick={onRetry}>
			{t('Retry')}
		</Button>
	) : undefined;

	if (state.kind === 'empty') {
		// A successful response with nothing in it is a fact about the system,
		// not a problem — no error styling, no retry shouting at the operator.
		return (
			<Box role="status" aria-live="polite" sx={{width: '100%', px: 1, py: 0.5, color: 'text.secondary', fontSize: '0.875rem'}}>
				{emptyMessage ?? t('No {{name}} entries yet', {name})}
			</Box>
		);
	}

	if (state.kind === 'stale') {
		const detail = specificDetail(state.failure);
		return (
			<Alert severity="warning" role="status" aria-live="polite" sx={{width: '100%'}} action={retry}>
				<AlertTitle sx={{mb: 0}}>{t('Out of date')}</AlertTitle>
				{t('Showing {{name}} last read at {{time}}. The latest refresh failed, so this may not match the server.', {
					name,
					time: new Date(state.fetchedAt).toLocaleTimeString(),
				})}
				{detail ? ` ${t(detail)}` : ''}
				{state.failure.correlationId ? ` ${t('Reference: {{id}}', {id: state.failure.correlationId})}` : ''}
			</Alert>
		);
	}

	const {result} = state;
	const detail = specificDetail(result);
	const headline =
		state.kind === 'denied'
			? t("You don't have permission to view {{name}}.", {name})
			: state.kind === 'unavailable'
				? t('{{name}} is temporarily unavailable.', {name})
				: t("Couldn't load {{name}}. The server returned an error.", {name});

	return (
		<Alert
			severity={state.kind === 'denied' ? 'warning' : 'error'}
			// A hard failure interrupts; denied and unavailable are polite —
			// both are recoverable situations the operator can act on without
			// having their current task cut across.
			role={state.kind === 'failed' ? 'alert' : 'status'}
			aria-live={state.kind === 'failed' ? 'assertive' : 'polite'}
			sx={{width: '100%'}}
			// Retrying a permission failure cannot help; retrying an outage can.
			action={result.retryable ? retry : undefined}
		>
			{headline}
			{detail ? ` ${t(detail)}` : ''}
			{result.correlationId ? ` ${t('Reference: {{id}}', {id: result.correlationId})}` : ''}
		</Alert>
	);
}
