//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import DownloadIcon from '@mui/icons-material/Download';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReplayIcon from '@mui/icons-material/Replay';
import SettingsIcon from '@mui/icons-material/Settings';
import StopIcon from '@mui/icons-material/Stop';
import {Button, Stack} from '@mui/material';
import SingleTextField from 'components/element/SingleTextField';
import StatCard from 'components/element/StatCard';
import ValueBunch from 'components/element/ValueBunch';
import IPsecConfigForm from 'components/input/IPsecConfigForm';
import IPsecTunnelInputForm from 'components/input/IPsecTunnelInputForm';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import IPsecSATable from 'components/table/ipsec/IPsecSATable';
import IPsecTunnelTable, {formatBytes} from 'components/table/ipsec/IPsecTunnelTable';
import {
	query_get_ipsec_tunnel_peerconfig,
	request_create_ipsec_tunnel,
	request_delete_ipsec_tunnel,
	request_ipsec_tunnel_action,
	request_set_ipsec_config,
	request_update_ipsec_tunnel,
} from 'connector/instance/ipsec';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useRole} from 'hooks/query/oamHooks';
import {useIPsecCACertificates, useIPsecCertificates, useIPsecConfig, useIPsecSAs, useIPsecStats, useIPsecTunnels} from 'hooks/query/queryHooks';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {t} from 'i18next';
import React, {Fragment, useRef, useState} from 'react';
import {IIPsecConfigMod, IIPsecTunnel, IIPsecTunnelAction, IIPsecTunnelMod} from 'types/ipsec';
import {toPageState} from 'components/state/pageState';

//---------------------------------------------------------
// Functional Components
//---------------------------------------------------------
function DetailPanel(props: {data: IIPsecTunnel; onAction?: (action: IIPsecTunnelAction) => void; onDownloadPeerConfig?: () => void}) {
	const {data, onAction, onDownloadPeerConfig} = props;
	const state = data.state ?? 'down';

	return (
		<SubTitlePannel title={data.name ?? ''} sub_title={t('Tunnel Details')}>
			<Stack spacing={2}>
				{(onAction || onDownloadPeerConfig) && (
					<Stack direction="row" spacing={1} flexWrap="wrap">
						{onAction && (
							<Fragment>
								<Button variant="outlined" size="small" startIcon={<PlayArrowIcon />} disabled={state === 'up'} onClick={() => onAction('initiate')}>
									{t('Initiate')}
								</Button>
								<Button variant="outlined" size="small" color="warning" startIcon={<StopIcon />} disabled={state === 'down'} onClick={() => onAction('terminate')}>
									{t('Terminate')}
								</Button>
								<Button variant="outlined" size="small" startIcon={<ReplayIcon />} disabled={state === 'down'} onClick={() => onAction('restart')}>
									{t('Restart')}
								</Button>
							</Fragment>
						)}
						{onDownloadPeerConfig && (
							<Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={onDownloadPeerConfig}>
								{t('Peer Config')}
							</Button>
						)}
					</Stack>
				)}
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
					<SingleTextField label={t('Proposal')} value={`${data.espEncryption}-${data.espIntegrity}${data.espDhGroup ? `-${data.espDhGroup} (PFS)` : ''}`} />
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
	const {can_write_gateway} = useRole();

	const tunnel_query = useIPsecTunnels(inst);
	const {data: tunnels, refetch: refetchTunnels} = tunnel_query;
	const {data: sas, refetch: refetchSAs} = useIPsecSAs(inst);
	const {data: stats, refetch: refetchStats} = useIPsecStats(inst);
	const {data: config, refetch: refetchConfig} = useIPsecConfig(inst);
	const {data: certs} = useIPsecCertificates(inst);
	const {data: caCerts} = useIPsecCACertificates(inst);

	const tunnelList = React.useMemo(() => [...(tunnels ?? [])].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')), [tunnels]);

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();

	// selected_rows holds a stable hash of the tunnel name (the row id the table
	// assigns), so selection tracks the tunnel across refetches/re-sorts instead
	// of a shifting array position.
	const selectedTunnel = selected_rows.length === 1 ? tunnelList.find(tn => getStableHash(tn.name ?? '') === selected_rows[0]) ?? null : null;

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
			isEdit ? t('Apply') : t('Add'),
			t('Cancel'),
			async () => {
				if (!tunnelFormRef.current) return;

				// In-place update (PUT): single config regen + reload on the gateway
				const res =
					isEdit && initial?.name
						? await request_update_ipsec_tunnel(inst, initial.name, tunnelFormRef.current)
						: await request_create_ipsec_tunnel(inst, tunnelFormRef.current);
				if (res.status === 'confirmed') {
					openPopUp(t('Success'), isEdit ? t('Tunnel updated successfully.') : t('Tunnel created successfully.'), t('OK'));
					set_selected_rows([]);
					setTimeout(refetchAll, 1000);
				} else showAddError('IPsec tunnel', t(res.localeKey));
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

	const handleTunnelAction = async (action: IIPsecTunnelAction) => {
		if (!inst || !selectedTunnel?.name) return;

		const res = await request_ipsec_tunnel_action(inst, selectedTunnel.name, action);
		if (res.status === 'confirmed') {
			openPopUp(t('Success'), t('Tunnel {{action}} completed.', {action}), t('OK'));
			setTimeout(refetchAll, 1000);
		} else showAddError('IPsec tunnel action', t(res.localeKey));
	};

	// Mirrored strongSwan config for the remote peer, saved as a text file.
	// Contains the PSK for psk tunnels — write-role only.
	const handleDownloadPeerConfig = async () => {
		if (!inst || !selectedTunnel?.name) return;

		const peer = await query_get_ipsec_tunnel_peerconfig(inst, selectedTunnel.name);
		if (!peer) {
			showAddError('IPsec peer config', t('Failed to generate peer configuration.') as string);
			return;
		}

		const parts = [peer.ipsecConf ?? ''];
		if (peer.ipsecSecrets) parts.push(`# ===== append to /etc/ipsec.secrets =====\n${peer.ipsecSecrets}\n`);
		if (peer.notes) parts.push(`# ===== notes =====\n# ${peer.notes}\n`);

		const blob = new Blob([parts.join('\n')], {type: 'text/plain'});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `ipsec-peer-${selectedTunnel.name}.conf`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const handleDelete = async () => {
		if (!inst || !selectedTunnel?.name) return;

		const res = await request_delete_ipsec_tunnel(inst, selectedTunnel.name);
		if (res.status === 'confirmed') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			setTimeout(refetchAll, 1000);
		} else showDeleteError('IPsec tunnel', t(res.localeKey));
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
				if (res.status === 'confirmed') {
					openPopUp(t('Success'), t('IPsec settings applied.'), t('OK'));
					setTimeout(() => refetchConfig(), 1000);
				} else showAddError('IPsec settings', t(res.localeKey));
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
			{/* Overview strip: aggregate stats + global settings entry point.
			    The Global Settings control is anchored to the header's right edge
			    so it no longer wraps onto its own floating band. */}
			<SubTitlePannel
				title={t('IPsec Overview')}
				sub_title={''}
				action={
					<Button variant="outlined" size="small" startIcon={<SettingsIcon />} onClick={handleGlobalSettings}>
						{t('Global Settings')}
					</Button>
				}
			>
				<Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
					<StatCard label={t('Tunnels Up')} value={stats?.tunnelsUp ?? 0} color={(stats?.tunnelsUp ?? 0) > 0 ? 'success' : undefined} />
					<StatCard label={t('Tunnels Down')} value={stats?.tunnelsDown ?? 0} color={(stats?.tunnelsDown ?? 0) > 0 ? 'error' : undefined} />
					<StatCard label={t('Active SAs')} value={stats?.totalSas ?? 0} />
					<StatCard label={t('Bytes In / Out')} value={`${formatBytes(stats?.totalBytesIn)} / ${formatBytes(stats?.totalBytesOut)}`} />
					<StatCard label={t('Errors')} value={totalErrors} color={totalErrors > 0 ? 'error' : undefined} tooltip={t('encrypt + decrypt + auth + replay errors') as string} />
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
				state={toPageState(tunnel_query, {op: 'ipsec_tunnel.list'})}
			/>

			{selectedTunnel && (
				<LowerSection>
					<Stack spacing={2}>
						<DetailPanel
							data={selectedTunnel}
							onAction={can_write_gateway ? handleTunnelAction : undefined}
							onDownloadPeerConfig={can_write_gateway ? handleDownloadPeerConfig : undefined}
						/>
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
