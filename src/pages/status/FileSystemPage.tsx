//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import FSTable from 'components/table/status/FSTable';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useStatus} from 'hooks/query/statusHook';
import {useState} from 'react';
import {IFilesystemInfo} from 'types/filesystem';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function FileSystemPage() {
	const inst = useInstanceFromURL();

	const {filesystemAttr} = useStatus(inst); // IFilesystemAttribute[]
	const fs_info: IFilesystemInfo = {filesystemAttr: filesystemAttr ?? []};

	const [selected_rows, set_selected_rows] = useState<number[]>([]);

	return <FSTable data={fs_info} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} />;
}
