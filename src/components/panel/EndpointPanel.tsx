//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import LBEndpointTable from 'components/table/traffic/LBEndpointTable';
import {useState} from 'react';
import {IEndpoint} from 'types/load_balancer';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function EndpointsPanel(props: {endpoints: IEndpoint[]}) {
	const {endpoints} = props;

	const [selected_rows, set_selected_rows] = useState<number[]>([]);

	return <LBEndpointTable data={endpoints} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} />;
}
