//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {StateCellSmall} from 'components/element/CustomGridCell';
import {SimpleTable} from 'components/table/SimpleTable';
import {extractHaData} from 'connector/extracts';
import {useHAState} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {IVipConfiguration} from 'types/ha';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function HACard(props: {instance: IInstance | null}) {
	const {instance} = props;

	const inst_name = instance?.name ?? '';
	const jump_url = `/instance/status/ha?name=${inst_name}`;

	const {data} = useHAState(instance); // IVipAttribute[]
	const ha_info: IVipConfiguration = {Attr: data ?? []};

	const ha_list = extractHaData(ha_info);

	return (
		<CardBase title={t('High Availability')} jump={{url: jump_url, name: t('View Full Data')}}>
			<SimpleTable
				columns={[
					{field: 'instance', headerName: 'Instance'},
					{field: 'vip', headerName: 'VIP'},
					{field: 'state', headerName: 'State', renderCell: StateCellSmall},
				]}
				rows={ha_list}
			/>
		</CardBase>
	);
}
