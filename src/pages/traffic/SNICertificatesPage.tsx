//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import AutorenewIcon from '@mui/icons-material/Autorenew';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {Button, Stack, Grid2} from '@mui/material';
import {getStableHash} from 'common';
import ParamBox from 'components/element/ParamBox';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import CertPemForm from 'components/input/CertPemForm';
import SNICertificateInputForm from 'components/input/SNICertificateInputForm';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import SNICertificatesTable from 'components/table/traffic/SNICertificatesTable';
import {request_delete_cert_pem, request_rotate_cert_pem, request_upload_cert_pem} from 'connector/instance/cert';
import {request_register_sni_certificate, request_unregister_sni_certificate} from 'connector/instance/sni_certificates';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useRole} from 'hooks/query/oamHooks';
import {useSNICertificates} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useRef, useState, useMemo} from 'react';
import {ICert, ISNICertificateEntry, ISNICertificateListItem} from 'types/security';

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
	const {data, isError, refetch} = useSNICertificates(inst);
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	const certificates = data?.certificates ?? [];
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- parked feature code kept for re-enablement; remove the disable when it is wired back up or deleted
	const totalCertificates = data?.totalCertificates ?? 0;

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();
	const formRef = useRef<ISNICertificateEntry | null>(null);

	// Hash function for SNI certificate (must match SNICertificatesTable row id)
	const getHashKey = (item: ISNICertificateListItem) => getStableHash(`${item.hostname}_${item.certPath}`);

	// Resolve selected hash ids back to certificate items (stable across refetch/re-sort)
	const selectedItems = useMemo(
		() =>
			selected_rows
				.map(h => certificates.find(a => getHashKey(a) === h))
				.filter((x): x is ISNICertificateListItem => x != null),
		[selected_rows, certificates],
	);
	const selectedItem: ISNICertificateListItem | null = selectedItems.length === 1 ? selectedItems[0] : null;

	// Selection handler: grid emits stable hash ids
	const handleSelectionChange = (hashes: number[]) => set_selected_rows(hashes);

	const handleDelete = async () => {
		if (!inst || selectedItems.length === 0) return;

		// Delete multiple selected certificates
		const deletePromises = selectedItems.map(async (cert) => {
			return request_unregister_sni_certificate(inst, {hostname: cert.hostname});
		});

		const results = await Promise.all(deletePromises);
		const failures = results.filter(res => res.status !== 'confirmed');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} certificate(s) successfully.', {count: results.length}), t('OK'));
			set_selected_rows([]);
			setTimeout(() => refetch(), 1000);
		} else if (failures.length < results.length) {
			// Partial success
			openPopUp(t('Warning'), t('{{success}} succeeded, {{failed}} failed.', {success: results.length - failures.length, failed: failures.length}), t('OK'));
			set_selected_rows([]);
			setTimeout(() => refetch(), 1000);
		} else {
			// All failed
			openPopUp(t('Error'), t('Failed to unregister. {{error}}', {error: t(failures[0].localeKey)}), t('OK'));
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
				if (res.status === 'confirmed') {
					openPopUp(t('Success'), t('Certificate registered successfully.'), t('OK'));
					setTimeout(() => refetch(), 1000);
				} else {
					openPopUp(t('Error'), t('Failed to register. {{error}}', {error: t(res.localeKey)}), t('OK'));
				}
			},
			true,
		);
	};

	const handleRefresh = () => {
		set_selected_rows([]);
		refetch();
	};

	// Inline-PEM certId store (/config/cert): upload POSTs new material and
	// auto-registers its SAN/CN hostnames; rotate PUTs under a stable certId.
	const {can_write_gateway} = useRole();
	const pemFormRef = useRef<(ICert & {isValid: boolean}) | null>(null);
	const certIdRef = useRef<string>('');

	const openPemDialog = (mode: 'upload' | 'rotate') => {
		if (!inst) return;

		const pem_form = (
			<CertPemForm
				key={Date.now()}
				mode={mode}
				onChange={data => {
					pemFormRef.current = data;
					enableYes(data.isValid);
				}}
			/>
		);

		openPopUp(
			'',
			pem_form,
			mode === 'rotate' ? t('Rotate') : t('Upload'),
			t('Cancel'),
			async () => {
				if (!pemFormRef.current) return;
				const {isValid, ...cert} = pemFormRef.current;
				if (cert.certId === '') delete cert.certId;

				const res =
					mode === 'rotate' ? await request_rotate_cert_pem(inst, cert.certId as string, cert) : await request_upload_cert_pem(inst, cert);
				if (res.status === 'confirmed') {
					openPopUp(t('Success'), mode === 'rotate' ? t('Certificate rotated successfully.') : t('Certificate uploaded successfully.'), t('OK'));
					setTimeout(() => refetch(), 1000);
				} else {
					openPopUp(t('Error'), t('Failed. {{error}}', {error: t(res.localeKey)}), t('OK'));
				}
			},
			true,
		);
	};

	const handleDeleteByCertId = () => {
		if (!inst) return;

		certIdRef.current = '';
		const id_form = (
			<ParamBox
				key={Date.now()}
				label={t('Cert ID')}
				value={''}
				onChange={(v: string) => {
					certIdRef.current = v;
					enableYes(v.trim().length > 0);
				}}
				param_desc={{type: 'string', description: 'Deletes the stored PEM material and unregisters its hostnames', required: true}}
			/>
		);

		openPopUp('', id_form, t('Delete'), t('Cancel'), async () => {
			const res = await request_delete_cert_pem(inst, certIdRef.current.trim());
			if (res.status === 'confirmed') {
				openPopUp(t('Success'), t('Certificate deleted.'), t('OK'));
				setTimeout(() => refetch(), 1000);
			} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: t(res.localeKey)}), t('OK'));
		});
	};

	return (
		<Fragment>
			{can_write_gateway && (
				<Stack direction="row" spacing={1} sx={{mb: 1}}>
					<Button variant="outlined" size="small" startIcon={<UploadFileIcon />} onClick={() => openPemDialog('upload')}>
						{t('Upload PEM')}
					</Button>
					<Button variant="outlined" size="small" startIcon={<AutorenewIcon />} onClick={() => openPemDialog('rotate')}>
						{t('Rotate (certId)')}
					</Button>
					<Button variant="outlined" size="small" color="warning" startIcon={<DeleteOutlineIcon />} onClick={handleDeleteByCertId}>
						{t('Delete (certId)')}
					</Button>
				</Stack>
			)}
			<SNICertificatesTable
				data={certificates}
				selected_rows={selected_rows}
				onChangeSelectedRows={handleSelectionChange}
				onAdd={handleAdd}
				onDelete={selectedItems.length > 0 ? handleDelete : undefined}
				onRefresh={handleRefresh}
				error={isError}
			/>
			{selectedItem && (
				<LowerSection>
					<DetailPanel cert={selectedItem} />
				</LowerSection>
			)}
		</Fragment>
	);
}
