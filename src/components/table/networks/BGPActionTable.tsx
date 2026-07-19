//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IActionSet} from 'types/bgp_policy_action';
import {IDataTableColumnDef} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BGPActionTable(props: {action_list: IActionSet[]; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any; error?: boolean}) {
	const {action_list, selected_rows, onChangeSelectedRows, onAdd, onDelete, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'routeDisposition', header: 'Route Disposition', tooltip: '“Handling” to specify how the policy should handle matching routes'},
		{data_key: 'setMed', header: 'Set MED', tooltip: 'Multi Exit Discriminator'},
		{data_key: 'setAsPathPrepend', header: 'Set AS Path Prepend', tooltip: 'AS Path Prepend'},
		{data_key: 'setCommunity', header: 'Set Community', tooltip: 'Community'},
		{data_key: 'setExtCommunity', header: 'Set Ext Community', tooltip: 'Extended Community'},
		{data_key: 'setLargeCommunity', header: 'Set Large Community', tooltip: 'Large Community'},
		{data_key: 'setLocalPref', header: 'Set Local Pref', tooltip: 'local preference (local-pref) prioritizes BGP route selection'},
		{data_key: 'setNextHop', header: 'Set Next Hop', tooltip: 'Specify the next hop in that path'},
	];

	const rows = action_list.map((action, index) => {
		return {
			id: index,
			routeDisposition: action.routeDisposition,
			setMed: action.bgpActions.setMed || '',
			setAsPathPrepend: action.bgpActions.setAsPathPrepend ? `AS: ${action.bgpActions.setAsPathPrepend.as}, Repeat: ${action.bgpActions.setAsPathPrepend.repeatN}` : '',
			setCommunity: action.bgpActions.setCommunity ? `${action.bgpActions.setCommunity.options} ${action.bgpActions.setCommunity.setCommunityMethod.join(', ')}` : '',
			setExtCommunity: action.bgpActions.setExtCommunity
				? `${action.bgpActions.setExtCommunity.options} ${action.bgpActions.setExtCommunity.setCommunityMethod.join(', ')}`
				: '',
			setLargeCommunity: action.bgpActions.setLargeCommunity
				? `${action.bgpActions.setLargeCommunity.options} ${action.bgpActions.setLargeCommunity.setCommunityMethod.join(', ')}`
				: '',
			setLocalPref: action.bgpActions.setLocalPerf !== undefined ? action.bgpActions.setLocalPerf.toString() : '',
			setNextHop: action.bgpActions.setNextHop || '',
		};
	});

	return <DataTable name={'Action'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} error={error} />;
}
