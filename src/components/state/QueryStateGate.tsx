//---------------------------------------------------------
// QueryStateGate — one rendering for every page data state (UI-P6-5)
//---------------------------------------------------------
// Wraps a table body, card or panel and renders the state the read is really
// in. Tables reach this through DataTable's `state` prop; surfaces that are
// not tables (dashboard cards, the log console, single-record panels) use the
// gate directly.
//
// Accessibility (ES-10) lives in PageStateBanner: the banner region is a live
// region so a state flip is announced rather than silently repainted.

import {Box, CircularProgress} from '@mui/material';
import {ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import PageStateBanner from './PageStateBanner';
import {PageDataState, writesEnabled} from './pageState';

export interface QueryStateGateProps<T> {
	state: PageDataState<T>;
	/** Localized resource name, e.g. t('Load Balancer Rule'). Used in every message. */
	name: string;
	/** Refetch for the retry affordance; omit only where retrying is meaningless. */
	onRetry?: () => void;
	/**
	 * Rendered for `data`, `empty` and `stale`. `rows` is undefined for
	 * `empty`, and for `stale` it is the last known-good payload.
	 */
	children: (rows: T | undefined, ctx: {writesEnabled: boolean; stale: boolean}) => ReactNode;
	/** Replaces the default "No {{name}} entries yet" copy for the empty state. */
	emptyMessage?: string;
	/** Skeleton/spinner for the loading state; a default is supplied. */
	loadingFallback?: ReactNode;
}

export default function QueryStateGate<T>({state, name, onRetry, children, emptyMessage, loadingFallback}: QueryStateGateProps<T>) {
	const {t} = useTranslation();

	if (state.kind === 'loading') {
		return (
			<>
				{loadingFallback ?? (
					<Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', py: 4}}>
						{/* A nameless progressbar is the axe violation UI-P2-2 had to
						    fix on the setup spinner — every busy indicator gets a name. */}
						<CircularProgress size={32} aria-label={t('Loading {{name}}...', {name})} />
					</Box>
				)}
			</>
		);
	}

	const banner = <PageStateBanner state={state} name={name} onRetry={onRetry} emptyMessage={emptyMessage} />;

	// denied / unavailable / failed: there are no rows to show, and rendering
	// the children with an empty payload is exactly the "error looks like an
	// empty resource" defect this task closes.
	if (state.kind === 'denied' || state.kind === 'unavailable' || state.kind === 'failed') return banner;

	const rows = state.kind === 'empty' ? undefined : state.rows;
	return (
		<>
			{banner}
			{children(rows, {writesEnabled: writesEnabled(state), stale: state.kind === 'stale'})}
		</>
	);
}
