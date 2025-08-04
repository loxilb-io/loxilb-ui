//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ChipField from 'components/element/ChipField';
import {t} from 'i18next';
import {IAllowedSource} from 'types/load_balancer';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function AllowedSourcesPanel(props: {allowedSources?: IAllowedSource[]}) {
	const {allowedSources} = props;

	const source_list: string[] = allowedSources ? allowedSources.map(source => source.prefix) : [t('None')];

	return <ChipField label={t('Allowed Sources')} item_list={source_list} />;
}
