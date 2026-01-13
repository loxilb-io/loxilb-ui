//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Grid2} from '@mui/material';
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
import {Fragment, useRef, useState} from 'react';
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

	const handleDelete = async () => {
		if (!inst || selected_rows.length !== 1) return;

		const cert = certificates[selected_rows[0]];
		if (!cert) return;

		openPopUp(
			t('Confirm Delete'),
			t('Are you sure you want to unregister the certificate for {{hostname}}?', {hostname: cert.hostname}),
			t('Delete'),
			t('Cancel'),
			async () => {
				const res = await request_unregister_sni_certificate(inst, {hostname: cert.hostname});
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Certificate unregistered successfully.'), t('OK'));
					set_selected_rows([]);
					setTimeout(() => refetch(), 1000);
				} else {
					openPopUp(t('Error'), t('Failed to unregister. {{error}}', {error: res.error}), t('OK'));
				}
			},
		);
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

	const selected_index = selected_rows.length === 1 ? selected_rows[0] : -1;

	return (
		<Fragment>
			<SNICertificatesTable
				data={certificates}
				selected_rows={selected_rows}
				onChangeSelectedRows={set_selected_rows}
				onAdd={handleAdd}
				onDelete={selected_rows.length === 1 ? handleDelete : undefined}
				onRefresh={refetch}
			/>
			{selected_index !== -1 && certificates[selected_index] && (
				<LowerSection>
					<DetailPanel cert={certificates[selected_index]} />
				</LowerSection>
			)}
		</Fragment>
	);
}
