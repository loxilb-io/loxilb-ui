//---------------------------------------------------------
// Imports
//---------------------------------------------------------

import MirrorTable from 'components/table/traffic/MirrorTable';
import {useMemo, useState} from 'react';
import {IMirrorConfiguration} from 'types/mirror';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function MirrorPanel(props: {lb_name: string; data: IMirrorConfiguration}) {
	const {lb_name, data} = props;

	const [selected_rows, set_selected_rows] = useState<number[]>([]);

	// Mirror : 모든 Mirror 정보에서 (Attach == 2) && (Target == LB Name)
	const filtered_data = useMemo(
		() => ({
			mirrAttr: data.mirrAttr.filter(item => item.targetObject.mirrObjName === lb_name),
		}),
		[data, lb_name],
	);

	return <MirrorTable data={filtered_data} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} />;
}
