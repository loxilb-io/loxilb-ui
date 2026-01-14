//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Grid2} from '@mui/material';
import {getStableHash} from 'common';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import SNICertificateInputForm from 'components/input/SNICertificateInputForm';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import SNICertificatesTable from 'components/table/traffic/SNICertificatesTable';
import {request_register_sni_certificate, request_unregister_sni_certificate} from 'connector/instance/sni_certificates';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useSNICertificates} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useRef, useState, useMemo} from 'react';
import {ISNICertificateEntry, ISNICertificateListItem} from 'types/security';

//---------------------------------------------------------
// Detail Panel Component
//---------------------------------------------------------
function DetailPanel(props: {cert: ISNICertificateListItem}) {
	const {cert} = props;

	return (
		<SubTitlePannel title={t('SNI Certificate Details')} sub_title={''}>
			<Stack spacing={2}>
				<ValueBunch name={t('Certificate Information')}>
					<Grid2 container spacing={2}>
						<SingleTextBox label={t('Hostname')} value={cert.hostname} />
						<SingleTextBox label={t('Certificate Path')} value={cert.certPath} />
						<SingleTextBox
							label={t('Reference Count')}
							value={cert.refCount.toString()}
							tooltip="Number of loadbalancer proxies using this certificate"
						/>
					</Grid2>
				</ValueBunch>
			</Stack>
		</SubTitlePannel>
	);
}

//---------------------------------------------------------
// Main Page Component
//---------------------------------------------------------
export default function SNICertificatesPage() {
	const inst = useInstanceFromURL();
	const {data, refetch} = useSNICertificates(inst);
	const certificates = data?.certificates ?? [];
	const totalCertificates = data?.totalCertificates ?? 0;

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();
	const formRef = useRef<ISNICertificateEntry | null>(null);

	// Hash function for SNI certificate
	const getHashKey = (item: ISNICertificateListItem) => {
		const str = `${item.hostname}_${item.certPath}`;
		return getStableHash(str);
	};

	// Sorted certificates
	const sortedCertificates = useMemo(() => 
		[...certificates].sort((a, b) => getHashKey(a) - getHashKey(b)),
		[certificates]
	);

	// Map selected original indices to sorted indices for display
	const selectedSortedIndices = useMemo(() => {
		if (certificates.length === 0 || selected_rows.length === 0) return [];
		
		return selected_rows
			.map(originalIdx => {
				const original = certificates[originalIdx];
				return sortedCertificates.findIndex(cert => getHashKey(cert) === getHashKey(original));
			})
			.filter(idx => idx !== -1);
	}, [selected_rows, certificates, sortedCertificates]);

	// Find single selected index for detail panel
	const selected_index = selectedSortedIndices.length === 1 ? selectedSortedIndices[0] : -1;

	// Selection handler: map sorted indices back to original indices
	const handleSelectionChange = (indices: number[]) => {
		if (certificates.length === 0) {
			set_selected_rows([]);
			return;
		}

		if (indices.length === 0) {
			set_selected_rows([]);
			return;
		}

		// Map each sorted index back to original index
		const originalIndices = indices
			.map(sortedIdx => {
				const sortedItem = sortedCertificates[sortedIdx];
				return certificates.findIndex(cert => getHashKey(cert) === getHashKey(sortedItem));
			})
			.filter(idx => idx !== -1);

		set_selected_rows(originalIndices);
	};

	const handleDelete = async () => {
		if (!inst || selected_rows.length === 0) return;

		// Delete multiple selected certificates
		const deletePromises = selected_rows.map(async (rowIndex) => {
			const cert = certificates[rowIndex];
			return request_unregister_sni_certificate(inst, {hostname: cert.hostname});
		});

		const results = await Promise.all(deletePromises);
		const failures = results.filter(res => res.status === 'error');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} certificate(s) successfully.', {count: selected_rows.length}), t('OK'));
			set_selected_rows([]);
			setTimeout(() => refetch(), 1000);
		} else if (failures.length < results.length) {
			// Partial success
			openPopUp(t('Warning'), t('{{success}} succeeded, {{failed}} failed.', {success: results.length - failures.length, failed: failures.length}), t('OK'));
			set_selected_rows([]);
			setTimeout(() => refetch(), 1000);
		} else {
			// All failed
			openPopUp(t('Error'), t('Failed to unregister. {{error}}', {error: failures[0].error}), t('OK'));
		}
	};

	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<SNICertificateInputForm
				key={Date.now()}
				onChange={data => {
					formRef.current = data;
					enableYes(data.isValid || false);
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Register'),
			t('Cancel'),
			async () => {
				if (!formRef.current) return;

				const res = await request_register_sni_certificate(inst, formRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Certificate registered successfully.'), t('OK'));
					setTimeout(() => refetch(), 1000);
				} else {
					openPopUp(t('Error'), t('Failed to register. {{error}}', {error: res.error}), t('OK'));
				}
			},
			true,
		);
	};

	const handleRefresh = () => {
		set_selected_rows([]);
		refetch();
	};

	return (
		<Fragment>
			<SNICertificatesTable
				data={sortedCertificates}
				selected_rows={selectedSortedIndices}
				onChangeSelectedRows={handleSelectionChange}
				onAdd={handleAdd}
				onDelete={selected_rows.length > 0 ? handleDelete : undefined}
				onRefresh={handleRefresh}
			/>
			{selected_index !== -1 && sortedCertificates[selected_index] && (
				<LowerSection>
					<DetailPanel cert={sortedCertificates[selected_index]} />
				</LowerSection>
			)}
		</Fragment>
	);
}
