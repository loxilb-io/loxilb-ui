//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IConditionSet} from 'types/bgp_policy_condition';
import {IDataTableColumnDef} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BGPConditionTable(props: {condition_list: IConditionSet[]; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any; error?: boolean}) {
	const {condition_list, selected_rows, onChangeSelectedRows, onAdd, onDelete, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'matchPrefixSet', header: 'Prefix'},
		{data_key: 'matchNeighborSet', header: 'Neighbor'},

		{data_key: 'matchCommunitySet', header: 'Community'},
		{data_key: 'matchExtCommunitySet', header: 'Ext Community'},
		{data_key: 'matchAsPathSet', header: 'AS Path'},

		{data_key: 'asPathLength', header: 'AS Path Len.', tooltip: 'Autonomous System Path Length'},
		{data_key: 'afiSafiIn', header: 'AFI SAFI In', tooltip: 'Address Family Identifier / Subsequent Address Family Identifier'},
		{data_key: 'nextHopInList', header: 'Next Hop'},
		{data_key: 'routeType', header: 'Route Type', tooltip: 'Determine what action to take on a route'},
		{data_key: 'rpki', header: 'RPKI', tooltip: 'Resource Public Key Infrastructure'},
	];

	const rows = condition_list.map((condition, index) => {
		return {
			id: index,
			matchPrefixSet: condition.matchPrefixSet ? `${condition.matchPrefixSet.prefixSet} (${condition.matchPrefixSet.matchSetOption})` : '',
			matchNeighborSet: condition.matchNeighborSet ? `${condition.matchNeighborSet.neighborSet} (${condition.matchNeighborSet.matchSetOption})` : '',

			matchCommunitySet: condition.bgpConditions.matchCommunitySet
				? `${condition.bgpConditions.matchCommunitySet.communitySet} (${condition.bgpConditions.matchCommunitySet.matchSetOptions})`
				: '',
			matchExtCommunitySet: condition.bgpConditions.matchExtCommunitySet
				? `${condition.bgpConditions.matchExtCommunitySet.communitySet} (${condition.bgpConditions.matchExtCommunitySet.matchSetOptions})`
				: '',
			matchAsPathSet: condition.bgpConditions.matchAsPathSet
				? `${condition.bgpConditions.matchAsPathSet.asPathSet} (${condition.bgpConditions.matchAsPathSet.matchSetOptions})`
				: '',

			asPathLength: condition.bgpConditions.asPathLength ? `${condition.bgpConditions.asPathLength.operator} ${condition.bgpConditions.asPathLength.value}` : '',
			afiSafiIn: condition.bgpConditions.afiSafiIn ? condition.bgpConditions.afiSafiIn.join(', ') : '',
			nextHopInList: condition.bgpConditions.nextHopInList ? condition.bgpConditions.nextHopInList.join(', ') : '',
			routeType: condition.bgpConditions.routeType || '',
			rpki: condition.bgpConditions.rpki || '',
		};
	});

	return <DataTable name={'Condition'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} error={error} />;
}
