//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import HATable from 'components/table/status/HATable';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useHAState} from 'hooks/query/queryHooks';
import {useState} from 'react';
import {IVipConfiguration} from 'types/ha';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function HAPage() {
	const inst = useInstanceFromURL();

	const {data} = useHAState(inst); // IVipAttribute[]
	const ha_info: IVipConfiguration = {Attr: data ?? []};
	const [selected_rows, set_selected_rows] = useState<number[]>([]);

	return <HATable data={ha_info} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} />;
}
