//---------------------------------------------------------
// License Management Table Component
//---------------------------------------------------------
import {getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IActiveLicense} from 'types/license';
import {t} from 'i18next';
import {useMemo} from 'react';

//---------------------------------------------------------
// Component Props Interface
//---------------------------------------------------------
interface LicenseManagementTableProps {
	data: {licenses: IActiveLicense[]};
	selected_rows: number[];
	onChangeSelectedRows: (indices: number[]) => void;
	// Mutation handlers are optional: omitted for roles without the
	// license_write capability (RBAC Phase 3), which hides the buttons.
	onAdd?: () => void;
	onDelete?: () => void;
	onUpdate?: () => void;
	onRefresh: () => void;
}

//---------------------------------------------------------
// Component Implementation
//---------------------------------------------------------
export default function LicenseManagementTable(props: LicenseManagementTableProps) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onUpdate, onRefresh} = props;

	const columns: IDataTableColumnDef[] = [
		{
			data_key: 'id',
			header: t('ID'),
			width: 'narrow'
		},
		{
			data_key: 'license_type',
			header: t('License Type'),
			width: 'medium'
		},
		{
			data_key: 'is_active',
			header: t('Status'),
			width: 'narrow'
		},
		{
			data_key: 'installed_at',
			header: t('Installed At'),
			width: 'medium'
		},
		{
			data_key: 'expires_at',
			header: t('Expires At'),
			width: 'medium'
		},
		{
			data_key: 'license_key_hash',
			header: t('License Key Hash'),
			width: 'super_wide'
		}
	];

	const getHashKey = (item: any) => {
		const str = `${item.id || ''}_${item.license_type || ''}_${item.license_key_hash || ''}`;
		return getStableHash(str);
	};

	// Generate rows and sort by hash key
	const rows = data.licenses
		? (() => {
			const sorted = [...data.licenses].sort((a, b) => getHashKey(a) - getHashKey(b));
			return sorted.map((item, index) => ({
				id: index,
				license_type: item.license_type?.toUpperCase() || 'N/A',
				is_active: item.is_active ? t('Active') : t('Inactive'),
				installed_at: item.installed_at ? new Date(item.installed_at).toLocaleDateString() : 'N/A',
				expires_at: item.expires_at ? new Date(item.expires_at).toLocaleDateString() : 'N/A',
				// license_key_hash: item.license_key_hash?.toString().substring(0, 20) + '...' || 'N/A',
				license_key_hash: item.license_key_hash?.toString() || 'N/A',
				_uniqueKey: getHashKey(item)
			}));
		})()
		: [];

	return (
		<DataTable
			name={t('License Management')}
			columns={columns}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onEdit={onUpdate}
			onDelete={onDelete}
			onRefresh={onRefresh}
		/>
	);
}