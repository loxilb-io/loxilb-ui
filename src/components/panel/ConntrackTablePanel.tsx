//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ConntrackTable from 'components/table/traffic/ConntrackTable';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useConntrack} from 'hooks/query/queryHooks';
import {useMemo, useState} from 'react';
import {ICtData} from 'types/conn_track';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function ConntrackTablePanel(props: {lb_name: string}) {
	const {lb_name} = props;

	const inst = useInstanceFromURL();
	const {data: ct_info} = useConntrack(inst);
	const [selected_rows, set_selected_rows] = useState<number[]>([]);

	const filtered_data = useMemo<ICtData>(() => ({ctAttr: ct_info?.ctAttr.filter(item => item.servName === lb_name) || []}), [ct_info, lb_name]);

	return <ConntrackTable data={filtered_data} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} />;
}
