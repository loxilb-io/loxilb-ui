//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import IPsecCACertUploadForm from 'components/input/IPsecCACertUploadForm';
import IPsecCertUploadForm from 'components/input/IPsecCertUploadForm';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import {IPsecCACertTable, IPsecCertTable} from 'components/table/ipsec/IPsecCertTable';
import {
	request_delete_ipsec_ca_certificate,
	request_delete_ipsec_certificate,
	request_upload_ipsec_ca_certificate,
	request_upload_ipsec_certificate,
} from 'connector/instance/ipsec';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useIPsecCACertificates, useIPsecCertificates} from 'hooks/query/queryHooks';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {t} from 'i18next';
import {Fragment, useRef, useState} from 'react';
import {IIPsecCACertificateMod, IIPsecCertificateMod} from 'types/ipsec';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function IPsecCertificatePage() {
	const inst = useInstanceFromURL();

	const {data: certs, refetch: refetchCerts} = useIPsecCertificates(inst);
	const {data: caCerts, refetch: refetchCACerts} = useIPsecCACertificates(inst);

	const [selectedCertRows, setSelectedCertRows] = useState<number[]>([]);
	const [selectedCARows, setSelectedCARows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();

	//--- endpoint certificates -------------------------------------------
	const certFormRef = useRef<IIPsecCertificateMod | null>(null);
	const handleCertAdd = () => {
		if (!inst) return;

		openPopUp(
			'',
			<IPsecCertUploadForm
				key={Date.now()}
				instance={inst}
				onChange={data => {
					const {isValid, ...cleanData} = data;
					certFormRef.current = cleanData;
					enableYes(isValid);
				}}
			/>,
			t('Upload'),
			t('Cancel'),
			async () => {
				if (!inst || !certFormRef.current) return;

				const res = await request_upload_ipsec_certificate(inst, certFormRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Certificate uploaded.'), t('OK'));
					setTimeout(() => refetchCerts(), 1000);
				} else showAddError('IPsec certificate', res.error);
			},
			true,
		);
	};

	const handleCertDelete = async () => {
		if (!inst || selectedCertRows.length !== 1) return;

		const item = (certs ?? [])[selectedCertRows[0]];
		if (!item?.name) return;

		const res = await request_delete_ipsec_certificate(inst, item.name);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			setSelectedCertRows([]);
			setTimeout(() => refetchCerts(), 1000);
		} else showDeleteError('IPsec certificate', res.error);
	};

	//--- CA certificates -------------------------------------------------
	const caFormRef = useRef<IIPsecCACertificateMod | null>(null);
	const handleCAAdd = () => {
		if (!inst) return;

		openPopUp(
			'',
			<IPsecCACertUploadForm
				key={Date.now()}
				onChange={data => {
					const {isValid, ...cleanData} = data;
					caFormRef.current = cleanData;
					enableYes(isValid);
				}}
			/>,
			t('Upload'),
			t('Cancel'),
			async () => {
				if (!inst || !caFormRef.current) return;

				const res = await request_upload_ipsec_ca_certificate(inst, caFormRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('CA certificate uploaded.'), t('OK'));
					setTimeout(() => refetchCACerts(), 1000);
				} else showAddError('CA certificate', res.error);
			},
			true,
		);
	};

	const handleCADelete = async () => {
		if (!inst || selectedCARows.length !== 1) return;

		const item = (caCerts ?? [])[selectedCARows[0]];
		if (!item?.name) return;

		const res = await request_delete_ipsec_ca_certificate(inst, item.name);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			setSelectedCARows([]);
			setTimeout(() => refetchCACerts(), 1000);
		} else showDeleteError('CA certificate', res.error);
	};

	return (
		<Fragment>
			<Stack spacing={3}>
				<IPsecCertTable
					data={certs ?? []}
					selected_rows={selectedCertRows}
					onChangeSelectedRows={setSelectedCertRows}
					onAdd={handleCertAdd}
					onDelete={handleCertDelete}
					onRefresh={() => {
						setSelectedCertRows([]);
						refetchCerts();
					}}
				/>
				<IPsecCACertTable
					data={caCerts ?? []}
					selected_rows={selectedCARows}
					onChangeSelectedRows={setSelectedCARows}
					onAdd={handleCAAdd}
					onDelete={handleCADelete}
					onRefresh={() => {
						setSelectedCARows([]);
						refetchCACerts();
					}}
				/>
			</Stack>

			{/* Error Popup */}
			<ErrorPopUp
				isOpen={errorPopup.isOpen}
				onClose={closeErrorPopup}
				title={errorPopup.title}
				mainMessage={errorPopup.mainMessage}
				errorData={errorPopup.errorData}
				buttonText={t('OK')}
			/>
		</Fragment>
	);
}
