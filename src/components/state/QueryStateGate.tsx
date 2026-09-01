//---------------------------------------------------------
// QueryStateGate — one rendering for every page data state (UI-P6-5)
//---------------------------------------------------------
// Wraps a table body, card or panel and renders the state the read is really
// in. Tables reach this through DataTable's `state` prop; surfaces that are
// not tables (dashboard cards, the log console, single-record panels) use the
// gate directly.
//
// Accessibility (ES-10): the banner region is a live region so a state flip is
// announced rather than silently repainted — `role="status"` for the benign
// transitions, `role="alert"` for a hard failure.

import {ReactNode} from 'react';
import {PageDataState} from './pageState';

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

export default function QueryStateGate<T>(props: QueryStateGateProps<T>): JSX.Element {
	// UI-P6-5 red commit: contract only. Implemented in the following commit.
	void props;
	throw new Error('QueryStateGate is not implemented yet (UI-P6-5)');
}
