//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import mirrortypes from 'assets/json/mirrortypes.json';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePortAttr} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useCallback, useEffect, useMemo, useRef} from 'react';
import {IEnumItem} from 'types/global';
import {IMirrorInfo} from 'types/mirror';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function MirrorInfoInputForm(props: {value: IMirrorInfo; onChange: (data: IMirrorInfo) => void; params?: any}) {
	const {value, onChange, params} = props;

	const inst = useInstanceFromURL();
	const typeList: IEnumItem[] = mirrortypes;

	// Synchronize type_index with value.type
	const type_index = useMemo(() => {
		if (value.type !== undefined) {
			const index = typeList.findIndex(item => Number(item.send_value) === value.type);
			return index !== -1 ? index : 0;
		}
		return 0;
	}, [value.type, typeList]);

	const {data: portData} = usePortAttr(inst);
	const portList: IEnumItem[] = useMemo(() => {
		if (!portData || !Array.isArray(portData)) return [];
		const interfaces = portData.map(port => port.portName).filter(Boolean);
		const uniqueInterfaces = [...new Set(interfaces)];
		return uniqueInterfaces.map((interfaceName, index) => ({id: index, name: interfaceName, send_value: interfaceName}));
	}, [portData]);

	// Route every mutation through a ref-merged emit so the several onChange
	// calls that land in the same React batch — the Type auto-default, the port
	// auto-init, and the disabled-field clears — merge instead of clobbering one
	// another via a stale `value` snapshot (same bug class fixed in the
	// QoS policyInfo subform). The ParamBox re-announces its default if a reset
	// transiently blanks a field, so the ref self-heals without folding `value`
	// back in (which would re-clobber it with the transient undefined).
	const mergedRef = useRef<IMirrorInfo>(value ?? ({} as IMirrorInfo));
	const emit = useCallback(
		(delta: Partial<IMirrorInfo>) => {
			mergedRef.current = {...mergedRef.current, ...delta};
			onChange({...mergedRef.current});
		},
		[onChange],
	);

	const handleChange = useCallback((field: keyof IMirrorInfo) => (newValue: any) => emit({[field]: newValue}), [emit]);

	const handleChangeType = useCallback(
		(send_value: string) => {
			const typeValue = send_value === '' ? undefined : Number(send_value);
			emit({type: typeValue});
		},
		[emit],
	);

	// Type에 따른 필드 활성화 조건
	// Type 0 (SPAN): Port만 활성화
	// Type 1 (RSPAN): Port, VLAN 활성화
	// Type 2 (ERSPAN): Port, VLAN, Tunnel ID, Source IP, Remote IP 모두 활성화
	const type_name = typeList[type_index]?.name || 'none';

	const isPortEnabled = type_name !== 'none';
	const isVlanEnabled = type_name === 'RSPAN' || type_name === 'ERSPAN';
	const isTunnelEnabled = type_name === 'ERSPAN';
	const isSourceIPEnabled = type_name === 'ERSPAN';
	const isRemoteIPEnabled = type_name === 'ERSPAN';

	const portInitialized = useRef(false);
	const typeInitialized = useRef(false);

	// Initialize type to 0 (SPAN) if undefined
	useEffect(() => {
		// Only initialize if type is undefined AND we haven't successfully set it yet
		if (value.type === undefined && !typeInitialized.current) {
			emit({type: 0});
			// DON'T set typeInitialized here - wait for value to actually change
		}

		// Mark as initialized only when type actually has a value
		if (value.type !== undefined && !typeInitialized.current) {
			typeInitialized.current = true;
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, [value, onChange]);

	// When type is set but port is not, set the first port (only once)
	useEffect(() => {
		// Only set port if type is defined, port is empty, and we have ports available
		if (value.type !== undefined && !value.port && portList.length > 0 && !portInitialized.current) {
			emit({port: portList[0].send_value as string});
			// DON'T set portInitialized here - wait for value to actually change
		}

		// Mark as initialized only when port actually has a value
		if (value.port && !portInitialized.current) {
			portInitialized.current = true;
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, [value.type, value.port, portList.length, onChange, value, portList]);

	useEffect(() => {
		// 타입이 변경될 때만 비활성화된 필드들을 초기화
		const updatedForm: Partial<IMirrorInfo> = {};
		let hasChanges = false;

		if (!isPortEnabled && value.port !== undefined) {
			updatedForm.port = undefined;
			hasChanges = true;
		}
		if (!isVlanEnabled && value.vlan !== undefined) {
			updatedForm.vlan = undefined;
			hasChanges = true;
		}
		if (!isTunnelEnabled && value.tunnelID !== undefined) {
			updatedForm.tunnelID = undefined;
			hasChanges = true;
		}
		if (!isSourceIPEnabled && value.sourceIP !== undefined) {
			updatedForm.sourceIP = undefined;
			hasChanges = true;
		}
		if (!isRemoteIPEnabled && value.remoteIP !== undefined) {
			updatedForm.remoteIP = undefined;
			hasChanges = true;
		}

		if (hasChanges) {
			emit(updatedForm);
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, [
		type_index,
		isPortEnabled,
		isVlanEnabled,
		isTunnelEnabled,
		isSourceIPEnabled,
		isRemoteIPEnabled,
		value.port,
		value.vlan,
		value.tunnelID,
		value.sourceIP,
		value.remoteIP,
		onChange,
	]);

	return (
		<Stack spacing={2}>
			<HorizontalStack>
			   <ParamBox label={t('Type')} value={value?.type ?? ''} onChange={handleChangeType} param_desc={{...params?.type, enum: typeList}} />
			   <ParamBox label={t('Port')} value={value?.port ?? ''} onChange={handleChange('port')} disabled={!isPortEnabled} param_desc={{...params?.port, enum: portList}} />
			   <ParamBox label={t('VLAN')} value={value?.vlan ?? ''} onChange={handleChange('vlan')} param_desc={params?.vlan} disabled={!isVlanEnabled} />
			   <ParamBox label={t('Tunnel ID')} value={value?.tunnelID ?? ''} onChange={handleChange('tunnelID')} param_desc={params?.tunnelID} disabled={!isTunnelEnabled} />
			</HorizontalStack>

			<HorizontalStack>
			   <ParamBox
				   label={t('Source IP')}
				   value={value?.sourceIP ?? ''}
				   onChange={handleChange('sourceIP')}
				   param_desc={{...params?.sourceIP, type: 'ipaddress'}}
				   disabled={!isSourceIPEnabled}
			   />
			   <ParamBox
				   label={t('Remote IP')}
				   value={value?.remoteIP ?? ''}
				   onChange={handleChange('remoteIP')}
				   param_desc={{...params?.remoteIP, type: 'ipaddress'}}
				   disabled={!isRemoteIPEnabled}
			   />
			</HorizontalStack>
		</Stack>
	);
}
