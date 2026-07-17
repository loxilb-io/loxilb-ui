//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import SettingsIcon from '@mui/icons-material/Settings';
import {Button, Stack} from '@mui/material';
import SingleTextField from 'components/element/SingleTextField';
import ValueBunch from 'components/element/ValueBunch';
import IPsecConfigForm from 'components/input/IPsecConfigForm';
import IPsecTunnelInputForm from 'components/input/IPsecTunnelInputForm';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import IPsecSATable from 'components/table/ipsec/IPsecSATable';
import IPsecTunnelTable, {formatBytes} from 'components/table/ipsec/IPsecTunnelTable';
import {request_create_ipsec_tunnel, request_delete_ipsec_tunnel, request_set_ipsec_config} from 'connector/instance/ipsec';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useIPsecCACertificates, useIPsecCertificates, useIPsecConfig, useIPsecSAs, useIPsecStats, useIPsecTunnels} from 'hooks/query/queryHooks';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {t} from 'i18next';
import React, {Fragment, useRef, useState} from 'react';
import {IIPsecConfigMod, IIPsecTunnel, IIPsecTunnelMod} from 'types/ipsec';

//---------------------------------------------------------
// Functional Components
//---------------------------------------------------------
function DetailPanel(props: {data: IIPsecTunnel}) {
	const {data} = props;

	return (
		<SubTitlePannel title={data.name ?? ''} sub_title={t('Tunnel Details')}>
			<Stack spacing={2}>
				<ValueBunch name={t('Connection')}>
					<SingleTextField label={t('State')} value={(data.state ?? 'down').toUpperCase()} />
					<SingleTextField label={t('Local')} value={data.localIp} />
					<SingleTextField label={t('Remote')} value={data.remoteIp} />
					<SingleTextField label={t('Mode')} value={data.tunnelMode} />
					<SingleTextField label={t('Startup')} value={data.auto} />
					<SingleTextField label={t('Auth')} value={data.authMode === 'cert' ? `cert (${data.certName} / CA ${data.caCertName})` : 'psk'} />
				</ValueBunch>
				<ValueBunch name={t('IKE (Phase 1)')}>
					<SingleTextField label={t('Version')} value={data.ikeVersion} />
					<SingleTextField label={t('Proposal')} value={`${data.ikeEncryption}-${data.ikeIntegrity}-${data.ikeDhGroup}`} />
					<SingleTextField label={t('Lifetime')} value={`${data.ikeLifetime ?? 0}s`} />
				</ValueBunch>
				<ValueBunch name={t('ESP (Phase 2)')}>
					<SingleTextField label={t('Proposal')} value={`${data.espEncryption}-${data.espIntegrity}`} />
					<SingleTextField label={t('Lifetime')} value={`${data.espLifetime ?? 0}s`} />
					<SingleTextField label={t('Selectors')} value={`${data.selector?.srcCidr || 'host'} ⇄ ${data.selector?.dstCidr || 'host'}`} />
				</ValueBunch>
				<ValueBunch name={t('Traffic & Lifecycle')}>
					<SingleTextField label={t('Bytes In / Out')} value={`${formatBytes(data.bytesIn)} / ${formatBytes(data.bytesOut)}`} />
					<SingleTextField label={t('Packets In / Out')} value={`${data.packetsIn ?? 0} / ${data.packetsOut ?? 0}`} />
					<SingleTextField label={t('SAs Installed')} value={(data.sasInstalled ?? 0).toString()} />
					<SingleTextField label={t('Last Rekey')} value={data.lastRekeyAt || '-'} />
					<SingleTextField label={t('DPD')} value={`${data.dpd?.action ?? 'restart'} ${data.dpd?.delay ?? 30}s/${data.dpd?.timeout ?? 150}s`} />
				</ValueBunch>
			</Stack>
		</SubTitlePannel>
	);
}

export default function IPsecTunnelPage() {
	const inst = useInstanceFromURL();

	const {data: tunnels, refetch: refetchTunnels} = useIPsecTunnels(inst);
	const {data: sas, refetch: refetchSAs} = useIPsecSAs(inst);
	const {data: stats, refetch: refetchStats} = useIPsecStats(inst);
	const {data: config, refetch: refetchConfig} = useIPsecConfig(inst);
	const {data: certs} = useIPsecCertificates(inst);
	const {data: caCerts} = useIPsecCACertificates(inst);

	const tunnelList = React.useMemo(() => [...(tunnels ?? [])].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')), [tunnels]);

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();

	const selected_index = selected_rows.length === 1 ? selected_rows[0] : -1;
	const selectedTunnel = selected_index !== -1 ? tunnelList[selected_index] : null;

	const refetchAll = () => {
		refetchTunnels();
		refetchSAs();
		refetchStats();
	};

	const tunnelFormRef = useRef<IIPsecTunnelMod | null>(null);
	const openTunnelForm = (initial?: Partial<IIPsecTunnelMod>, isEdit?: boolean) => {
		if (!inst) return;

		const input_form = (
			<IPsecTunnelInputForm
				key={Date.now()}
				value={initial}
				isEdit={isEdit}
				certificates={certs ?? []}
				caCertificates={caCerts ?? []}
				onChange={data => {
					const {isValid, ...cleanData} = data;
					tunnelFormRef.current = cleanData;
					enableYes(isValid);
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			isEdit ? t('Recreate') : t('Add'),
			t('Cancel'),
			async () => {
				if (!tunnelFormRef.current) return;

				// Recreate-based edit: the gateway has no tunnel update op
				if (isEdit && initial?.name) {
					const delRes = await request_delete_ipsec_tunnel(inst, initial.name);
					if (delRes.status !== 'success') {
						showAddError('IPsec tunnel', delRes.error);
						return;
					}
				}
				const res = await request_create_ipsec_tunnel(inst, tunnelFormRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), isEdit ? t('Tunnel recreated successfully.') : t('Tunnel created successfully.'), t('OK'));
					set_selected_rows([]);
					setTimeout(refetchAll, 1000);
				} else showAddError('IPsec tunnel', res.error);
			},
			true,
		);
	};

	const handleAdd = () => openTunnelForm();

	const handleEdit = () => {
		if (!selectedTunnel) return;
		// GET never returns the PSK — it must be re-entered in the form
		const {state, installedAt, bytesIn, bytesOut, packetsIn, packetsOut, lastRekeyAt, sasInstalled, ...conf} = selectedTunnel;
		openTunnelForm({...(conf as Partial<IIPsecTunnelMod>), psk: ''}, true);
	};

	const handleDelete = async () => {
		if (!inst || !selectedTunnel?.name) return;

		const res = await request_delete_ipsec_tunnel(inst, selectedTunnel.name);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			setTimeout(refetchAll, 1000);
		} else showDeleteError('IPsec tunnel', res.error);
	};

	const configFormRef = useRef<IIPsecConfigMod | null>(null);
	const handleGlobalSettings = () => {
		if (!inst) return;

		const config_form = (
			<IPsecConfigForm
				key={Date.now()}
				value={config}
				onChange={data => {
					const {isValid, ...cleanData} = data;
					configFormRef.current = cleanData;
					enableYes(isValid);
				}}
			/>
		);

		openPopUp(
			'',
			config_form,
			t('Apply'),
			t('Cancel'),
			async () => {
				if (!configFormRef.current) return;

				const res = await request_set_ipsec_config(inst, configFormRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('IPsec settings applied.'), t('OK'));
					setTimeout(() => refetchConfig(), 1000);
				} else showAddError('IPsec settings', res.error);
			},
			true,
		);
	};

	const handleRefresh = () => {
		set_selected_rows([]);
		refetchAll();
	};

	const selectedSAs = selectedTunnel ? (sas ?? []).filter(sa => sa.tunnelName === selectedTunnel.name) : [];
	const totalErrors = (stats?.encryptErrors ?? 0) + (stats?.decryptErrors ?? 0) + (stats?.authErrors ?? 0) + (stats?.replayErrors ?? 0);

	return (
		<Fragment>
			{/* Overview strip: aggregate stats + global settings entry point */}
			<SubTitlePannel title={t('IPsec Overview')} sub_title={''}>
				<Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
					<ValueBunch name={''}>
						<SingleTextField label={t('Tunnels Up')} value={(stats?.tunnelsUp ?? 0).toString()} />
						<SingleTextField label={t('Tunnels Down')} value={(stats?.tunnelsDown ?? 0).toString()} />
						<SingleTextField label={t('Active SAs')} value={(stats?.totalSas ?? 0).toString()} />
						<SingleTextField label={t('Bytes In / Out')} value={`${formatBytes(stats?.totalBytesIn)} / ${formatBytes(stats?.totalBytesOut)}`} />
						<SingleTextField label={t('Errors')} value={totalErrors.toString()} tooltip={t('encrypt + decrypt + auth + replay errors') as string} />
					</ValueBunch>
					<Button variant="outlined" size="small" startIcon={<SettingsIcon />} onClick={handleGlobalSettings}>
						{t('Global Settings')}
					</Button>
				</Stack>
			</SubTitlePannel>

			<IPsecTunnelTable
				data={tunnelList}
				selected_rows={selected_rows}
				onChangeSelectedRows={set_selected_rows}
				onAdd={handleAdd}
				onEdit={handleEdit}
				onDelete={handleDelete}
				onRefresh={handleRefresh}
			/>

			{selectedTunnel && (
				<LowerSection>
					<Stack spacing={2}>
						<DetailPanel data={selectedTunnel} />
						<IPsecSATable data={selectedSAs} onRefresh={() => refetchSAs()} />
					</Stack>
				</LowerSection>
			)}

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
