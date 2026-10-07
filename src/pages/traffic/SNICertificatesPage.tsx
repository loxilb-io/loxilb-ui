//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import AutorenewIcon from '@mui/icons-material/Autorenew';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {Alert, Button, Stack, Grid2} from '@mui/material';
import {useQueryClient} from '@tanstack/react-query';
import {getStableHash} from 'common';
import ParamBox from 'components/element/ParamBox';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import CertPemForm from 'components/input/CertPemForm';
import SNICertificateInputForm from 'components/input/SNICertificateInputForm';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import SNICertificatesTable from 'components/table/traffic/SNICertificatesTable';
import CertLookupPanel from 'components/panel/CertLookupPanel';
import {confirm_cert_material, createdCertId, lookup_cert, request_delete_cert_pem, request_rotate_cert_pem, request_upload_cert_pem} from 'connector/instance/cert';
import {request_register_sni_certificate, request_unregister_sni_certificate} from 'connector/instance/sni_certificates';
import {OpResult} from 'connector/fetcher/opResult';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useRole} from 'hooks/query/oamHooks';
import {useLoadBalancerConfig, useMetadata, useSNICertificates} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {ComponentProps, Fragment, useRef, useState, useMemo} from 'react';
import {IServiceConfiguration} from 'types/load_balancer';
import {ICert, ISNICertificateEntry, ISNICertificateListItem} from 'types/security';
import {toPageState} from 'components/state/pageState';

//---------------------------------------------------------
// SNI-store soft errors follow the snapshot inline-error convention:
// localized headline first, the store's verbatim detail after. The store
// reports domain rejections inside a 200 body ("Error: Failed to load
// certificate … Check certificate files at <path>") — operator-actionable
// text that the generic OpResult copy would erase, so this family
// deliberately renders rawDetail.
//---------------------------------------------------------
function sniOpErrorText(res: Pick<OpResult, 'localeKey' | 'rawDetail'>): string {
	const detail = res.rawDetail?.trim();
	return detail ? `${t(res.localeKey)} ${detail}` : t(res.localeKey);
}

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
/**
 * The PEM form with the usage choice gated on what THIS gateway declares.
 *
 * ⚠️ The vendored spec says what the newest gateway accepts, not this one. A
 * gateway that predates `usage` stores every entry as a listener certificate,
 * so the choice is offered only where its own schema has it. The schema is
 * read here, inside the dialog, so a read that lands after the dialog opened
 * still brings the choice in; the dialog's contents are fixed when it opens.
 */
function GatedCertPemForm(props: Omit<ComponentProps<typeof CertPemForm>, 'usageDeclared'>) {
	const inst = useInstanceFromURL();
	const {get_param} = useMetadata(inst, '/config/cert');
	return <CertPemForm {...props} usageDeclared={get_param(['usage']) !== undefined} />;
}

/** The rules that name a certificate ID for their backend leg, by the name an operator knows them by. */
export function rulesUsingCert(rules: readonly IServiceConfiguration[], certId: string): string[] {
	if (certId === '') return [];
	return rules
		.filter(rule => rule.serviceArguments?.backend_ca_cert_id === certId || rule.serviceArguments?.backend_client_cert_id === certId)
		.map(rule => rule.serviceArguments.name || `${rule.serviceArguments.externalIP}:${rule.serviceArguments.port}/${rule.serviceArguments.protocol}`);
}

/**
 * The ID to delete, with what this UI can see of its use.
 *
 * The gateway refuses to delete a certificate a rule uses, and it is the one
 * that knows. What is shown here is a reading of the rule list as loaded: it
 * can name a rule that will cause the refusal, and it says so when the list
 * could not be read — it never says an ID is free to delete.
 */
function CertDeleteForm(props: {onChange: (certId: string) => void}) {
	const inst = useInstanceFromURL();
	const lb_query = useLoadBalancerConfig(inst);
	const [certId, setCertId] = useState('');
	const id = certId.trim();
	const users = rulesUsingCert(lb_query.data ?? [], id);

	return (
		<Stack spacing={2}>
			<ParamBox
				label={t('Cert ID')}
				value={certId}
				onChange={(v: string) => {
					setCertId(v);
					props.onChange(v);
				}}
				param_desc={{type: 'string', description: 'Deletes the stored PEM material and unregisters its hostnames', required: true}}
			/>
			{id !== '' &&
				(lb_query.data === undefined || lb_query.isError ? (
					<Alert severity="info">{t('The rule list could not be read, so it is not known whether a rule uses this ID. The gateway refuses to delete a certificate that a rule uses.')}</Alert>
				) : users.length > 0 ? (
					<Alert severity="warning">{t('Used for the backend leg of: {{rules}}. The gateway refuses to delete a certificate that a rule uses; remove it from the rule first.', {rules: users.join(', ')})}</Alert>
				) : (
					<Alert severity="info">{t('No loaded rule names this ID for its backend leg. The gateway checks again when the delete is sent.')}</Alert>
				))}
		</Stack>
	);
}

export default function SNICertificatesPage() {
	const inst = useInstanceFromURL();
	const queryClient = useQueryClient();
	const sni_query = useSNICertificates(inst);
	const {data, refetch} = sni_query;
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
			openPopUp(t('Error'), t('Failed to unregister. {{error}}', {error: sniOpErrorText(failures[0])}), t('OK'));
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
					openPopUp(t('Error'), t('Failed to register. {{error}}', {error: sniOpErrorText(res)}), t('OK'));
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
			<GatedCertPemForm
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

				const res =
					mode === 'rotate' ? await request_rotate_cert_pem(inst, cert.certId as string, cert) : await request_upload_cert_pem(inst, cert);
				if (res.status === 'confirmed') {
					setTimeout(() => refetch(), 1000);
					// A rule shows the policy its listener runs; a rotated CA bundle
					// or client certificate changes that under the same ID.
					if (mode === 'rotate') queryClient.invalidateQueries({predicate: query => query.queryKey.includes('lb_data')});

					// The request was accepted; what is stored is a second question,
					// answered by reading the entry back. When the request named no
					// ID the gateway chose one and answers with it; a gateway that
					// answers with an empty body leaves nothing to read.
					const named = (cert.certId ?? '').trim();
					const id = named || (mode === 'upload' ? createdCertId(res) : '');
					if (id === '') {
						openPopUp(t('Success'), t('Certificate uploaded. No ID was given, so the gateway chose one and does not report it: the entry cannot be looked up from here. Its hostnames appear in the table.'), t('OK'));
						return;
					}
					const stored = await confirm_cert_material(inst, id, cert.certPem);
					if (stored.kind === 'found' && stored.material === 'match') {
						openPopUp(
							t('Success'),
							mode === 'rotate'
								? t('Certificate "{{id}}" was rotated: the certificate stored under the ID is the one submitted. This confirms what is stored, not that traffic is using it.', {id})
								: named === ''
									? t('Certificate uploaded. No ID was given, so the gateway chose "{{id}}": the certificate stored under that ID is the one submitted. Keep the ID; it is what rotates or deletes the certificate.', {id})
									: t('Certificate "{{id}}" was uploaded: the certificate stored under the ID is the one submitted.', {id}),
							t('OK'),
						);
					} else if (stored.kind === 'found') {
						openPopUp(t('Warning'), t('The request was accepted, but the certificate stored under "{{id}}" is not the one submitted.', {id}), t('OK'));
					} else if (stored.kind === 'absent') {
						openPopUp(t('Warning'), t('The request was accepted, but nothing is stored under "{{id}}".', {id}), t('OK'));
					} else {
						openPopUp(t('Warning'), t('The request was accepted, but "{{id}}" could not be read back, so what is stored is not confirmed. {{error}}', {id, error: t(stored.result.localeKey)}), t('OK'));
					}
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
			<CertDeleteForm
				key={Date.now()}
				onChange={v => {
					certIdRef.current = v;
					enableYes(v.trim().length > 0);
				}}
			/>
		);

		openPopUp('', id_form, t('Delete'), t('Cancel'), async () => {
			const id = certIdRef.current.trim();
			const res = await request_delete_cert_pem(inst, id);
			if (res.status !== 'confirmed') {
				// A 400 here is the gateway refusing because a rule uses the ID, and
				// only its sentence names the rule. Nothing the operator typed is in
				// it: a delete carries an ID and no certificate material.
				openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.httpStatus === 400 ? sniOpErrorText(res) : t(res.localeKey)}), t('OK'));
				return;
			}
			setTimeout(() => refetch(), 1000);
			// Accepted is not gone. Only a 404 on the entry says it is; a read
			// that fails any other way has not said so.
			const after = await lookup_cert(inst, id);
			if (after.kind === 'absent') openPopUp(t('Success'), t('Certificate "{{id}}" was deleted: the gateway no longer stores it.', {id}), t('OK'));
			else if (after.kind === 'found') openPopUp(t('Warning'), t('The delete was accepted, but "{{id}}" is still stored.', {id}), t('OK'));
			else openPopUp(t('Warning'), t('The delete was accepted, but whether "{{id}}" is gone could not be confirmed. {{error}}', {id, error: t(after.result.localeKey)}), t('OK'));
		}, true);
	};

	return (
		<Fragment>
			<CertLookupPanel instance={inst} />
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
				state={toPageState(sni_query, {op: 'sni_certificate.list'})}
			/>
			{selectedItem && (
				<LowerSection>
					<DetailPanel cert={selectedItem} />
				</LowerSection>
			)}
		</Fragment>
	);
}
