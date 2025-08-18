//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import mirrortypes from 'assets/json/mirrortypes.json';
import DataTable from 'components/table/DataTable';
import {useInstanceName} from 'hooks/query/instanceHook';
import {IDataTableColumnDef} from 'types/global';
import {IMirrorConfiguration} from 'types/mirror';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function MirrorTable(props: {data: IMirrorConfiguration; selected_rows: number[]; onChangeSelectedRows: any; onAdd?: any; onDelete?: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;
	const type_name_set = mirrortypes.map(type => type.name);

	const cols: IDataTableColumnDef[] = [
		{data_key: 'mirrorIdent', header: 'Name', width: 'wide'},
		{data_key: 'type', header: 'Type', tooltip: 'Mirr Type(0-SPAN, 1-RSPAN, 2-ERSPAN)'},
		{data_key: 'attachment', header: 'Attachment', width: 'wide', type: 'link', tooltip: 'Target Attachment(0-LB Rule Name, 1-Port Name)'},
		{data_key: 'sync', header: 'Sync', type: 'state'},
	];

	//targetObject: {
	//	attachment: 1,
	//	mirrObjName: 'api-server-1',
	//},
	// Attachment는 1,2 로 1은 mirrObjName이 Interface이름, 2는 mirrObjName이 LB Rule이름으로 정함

	const inst_name = useInstanceName();
   // Hash function for mirror
   const getHashKey = (item: any) => {
	   const str = `${item.mirrorIdent || ''}_${item.targetObject.attachment || ''}_${item.targetObject.mirrObjName || ''}`;
	   let hash = 0;
	   for (let i = 0; i < str.length; i++) {
		   hash = ((hash << 5) - hash) + str.charCodeAt(i);
		   hash |= 0;
	   }
	   return hash >>> 0;
   };

   const rows = data.mirrAttr
	   ? (() => {
		   const sorted = [...data.mirrAttr].sort((a, b) => getHashKey(a) - getHashKey(b));
		   return sorted.map((item, index) => {
			   return {
				   id: index,
				   mirrorIdent: item.mirrorIdent,
				   type: item.mirrorInfo.type ? `${item.mirrorInfo.type}(${type_name_set[item.mirrorInfo.type]})` : '0',
				   attachment: {
					   data: `${item.targetObject.attachment}(${item.targetObject.mirrObjName})`,
					   url:
						   item.targetObject.attachment === 1
							   ? `/instance/network/port?name=${inst_name}&port=${item.targetObject.mirrObjName}`
							   : `/instance/traffic/lb?name=${inst_name}&rule=${item.targetObject.mirrObjName}`,
				   },
				   sync: item.sync,
				   _uniqueKey: getHashKey(item),
			   };
		   });
	   })()
	   : undefined;

	return <DataTable name={'Mirror'} columns={cols} rows={rows || []} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} />;
}
