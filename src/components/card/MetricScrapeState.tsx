//---------------------------------------------------------
// MetricScrapeState — a dashboard card saying why it has no numbers
//---------------------------------------------------------
// The metrics scrape is the one read in the app that deliberately does not
// throw: it polls every ten seconds, and a card that tore itself down on a
// single bad scrape would flicker rather than inform. So it carries its
// failure as a value instead, and this is where that value becomes words.
//
// Without it, every card fell through to "Not reported by this instance",
// which blames the instance for choosing not to publish a metric — when in
// fact the scrape may have been refused (401 under --userservice), collection
// may be switched off (503), or the instance may be genuinely broken (5xx).
// Same rendering as every other page state, so a denied scrape and a denied
// list read alike.

import {useTranslation} from 'react-i18next';
import CardBase from './CardBase';
import PageStateBanner from 'components/state/PageStateBanner';
import {OpResult} from 'connector/fetcher/opResult';
import {fromFailure} from 'components/state/pageState';

export interface MetricScrapeStateProps {
	title: string;
	failure: OpResult;
	onRetry?: () => void;
}

export default function MetricScrapeState({title, failure, onRetry}: MetricScrapeStateProps) {
	const {t} = useTranslation();
	return (
		<CardBase title={title}>
			<PageStateBanner state={fromFailure(failure)} name={t('Metrics')} onRetry={onRetry} />
		</CardBase>
	);
}
