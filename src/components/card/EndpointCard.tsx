//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box} from '@mui/material';
import PieChartWithTitle from 'components/element/PieChartWithTitle';
import DropDownMenu from 'components/menu/DropDownMenu';
import {useMetrics} from 'hooks/query/metricsHook';
import {t} from 'i18next';
import {useEffect, useMemo, useState} from 'react';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function EndpointCard(props: {instance: IInstance | null}) {
	const {instance} = props;

	const {endpointSnapshot} = useMetrics(instance);

	const key_list = useMemo(() => Object.keys(endpointSnapshot ?? {}), [endpointSnapshot]);
	const [cur_key, set_cur_key] = useState(key_list[0] || '');

	const chart_data = useMemo(() => {
		const entries = endpointSnapshot?.[cur_key] ?? [];
		const used_items = entries.map((entry, index) => ({
			id: index,
			label: entry.dip ?? t('none'),
			value: entry.ratio * 100,
		}));

		return used_items;
	}, [endpointSnapshot, cur_key]);

	const handleChange = (index: number) => {
		set_cur_key(key_list[index]);
	};

	useEffect(() => {
		set_cur_key(key_list[0] || '');
	}, [key_list]);

	return (
		<CardBase title={t('Endpoint Traffic Overview')}>
			<Box width="100%" display="flex" alignItems="flex-start" justifyContent="space-between">
				<PieChartWithTitle data={chart_data} />

				<Box width="120px">
					<DropDownMenu label={t('Targets')} item_list={key_list} onMenuChange={handleChange} />
				</Box>
			</Box>
		</CardBase>
	);
}
