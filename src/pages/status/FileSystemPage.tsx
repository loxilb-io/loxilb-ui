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

	// Since useStatus currently uses dummy data, create a simple refresh function
	const handleRefresh = () => {
		// For now, this will just trigger a re-render
		// When the real API is implemented, this should call the actual refetch function
		console.log('Refreshing filesystem data...');
	};

	return <FSTable data={fs_info} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} onRefresh={handleRefresh} />;
}
