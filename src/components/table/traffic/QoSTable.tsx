//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {get_size_str, getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {useInstanceName} from 'hooks/query/instanceHook';
import {t} from 'i18next';
import {IDataTableColumnDef} from 'types/global';
import {IPolicyConfiguration, qosAttachmentLabel, qosTargetUrl} from 'types/qos';
import {PageDataState} from 'components/state/pageState';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function QoSTable(props: {data: IPolicyConfiguration; selected_rows: number[]; onChangeSelectedRows: any; onAdd?: any; onDelete?: any; onRefresh?: any; state?: PageDataState<unknown>; error?: boolean}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onRefresh, state, error} = props;

	const inst_name = useInstanceName();

	const cols: IDataTableColumnDef[] = [
		{data_key: 'policyIdent', header: 'Name'},
		{data_key: 'type', header: 'Type', width: 'medium', type: 'tag', tooltip: 'Qos Type (0-TrTCM, 1-SrTCM)'},
		{data_key: 'attachment', header: 'Attachment', width: 'wide', type: 'link', tooltip: 'Load-balancer rule, port ingress, or host-originated port egress'},
		{data_key: 'rate', header: `${t('Info Rate (Mbps)')}\n${t('(Committed / Peak)')}`, type: 'multi-line', align: 'right', width: 'super_wide'},
		{data_key: 'blocksize', header: `${t('Block Size (bytes)')}\n${t('(Committed / Excess)')}`, type: 'multi-line', align: 'right', width: 'super_wide'},
		{data_key: 'colorAware', header: 'Color Aware', type: 'boolean'},
	];

   // Hash function for QoS policy
   const getHashKey = (item: any) => {
	   const str = `${item.policyIdent || ''}_${item.policyInfo.type || ''}_${item.targetObject.attachment || ''}_${item.targetObject.polObjName || ''}`;
	   return getStableHash(str);
   };

   const rows = data.polAttr
	   ? (() => {
		   const sorted = [...data.polAttr].sort((a, b) => getHashKey(a) - getHashKey(b));
		   return sorted.map(item => {
			   return {
				   id: getHashKey(item),
				   policyIdent: item.policyIdent,
				   type: item.policyInfo.type,
					   rate: `${item.policyInfo.committedInfoRate} Mbps / ${item.policyInfo.peakInfoRate} Mbps`,
				   blocksize: `${get_size_str(item.policyInfo.committedBlkSize)} / ${get_size_str(item.policyInfo.excessBlkSize)}`,
				   attachment: {
						   data: `${qosAttachmentLabel(item.targetObject.attachment)} (${item.targetObject.polObjName})`,
						   url: qosTargetUrl(inst_name, item.targetObject),
				   },
				   colorAware: item.policyInfo.colorAware ? 'True' : 'False',
				   _uniqueKey: getHashKey(item),
			   };
		   });
	   })()
	   : undefined;

	return <DataTable name={'QoS'} columns={cols} rows={rows || []} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} onRefresh={onRefresh} state={state} error={error} hideCheckbox={true} />;
}
