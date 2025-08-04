//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ChipField from 'components/element/ChipField';
import {t} from 'i18next';
import {ISecondaryIP} from 'types/load_balancer';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SecondaryIPsPanel(props: {secondaryIPs?: ISecondaryIP[]}) {
	const {secondaryIPs} = props;

	const ip_list: string[] = secondaryIPs ? secondaryIPs.map(ip => ip.secondaryIP ?? t('None')) : [t('None')];

	return <ChipField label={t('Secondary IPs')} item_list={ip_list} />;
}
