//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import QoSTable from 'components/table/traffic/QoSTable';
import {useMemo, useState} from 'react';
import {IPolicyConfiguration, qosPoliciesForRule} from 'types/qos';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function QoSPanel(props: {lb_target: string; data: IPolicyConfiguration}) {
	const {lb_target, data} = props;

	const [selected_rows, set_selected_rows] = useState<number[]>([]);

	// Rule attachments use the Gateway's VIP:PORT:PROTO key, not the display name.
	const filtered_data = useMemo(
		() => ({
			polAttr: qosPoliciesForRule(data.polAttr, lb_target),
		}),
		[data, lb_target],
	);

	return <QoSTable data={filtered_data} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} />;
}
