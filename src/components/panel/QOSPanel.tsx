//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import QoSTable from 'components/table/traffic/QoSTable';
import {useMemo, useState} from 'react';
import {IPolicyAttribute, IPolicyConfiguration} from 'types/qos';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function QoSPanel(props: {lb_name: string; data: IPolicyConfiguration}) {
	const {lb_name, data} = props;

	const [selected_rows, set_selected_rows] = useState<number[]>([]);

	// Qos : 모든 Qos 정보에서 (Attach == 2) && (Target == LB Name)
	const filtered_data = useMemo(
		() => ({
			polAttr: data.polAttr.filter((item: IPolicyAttribute) => item.targetObject.attachment === 2 && item.targetObject.polObjName === lb_name),
		}),
		[data, lb_name],
	);

	return <QoSTable data={filtered_data} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} />;
}
