//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import React from 'react';
import {Stack, Typography} from '@mui/material';
import {isValidIPAddress} from 'common';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IServiceConfiguration} from 'types/load_balancer';
import {AllowedSourcesListInputForm, SecondaryIPListInputForm} from './IPListInputForm';
import AdvancedSettingsForm from './subforms/AdvancedSettingsForm';
import AIGatewaySettingsForm from './subforms/AIGatewaySettingsForm';
import BasicSettingsForm from './subforms/BasicSettingsForm';
import EndpointListForm from './subforms/EndpointListForm';
// import HealthCheckForm from './subforms/HealthCheckForm'; // Moved to EndpointListForm
import SecurityOptionsForm from './subforms/SecurityOptionsForm';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
interface LBInputFormProps {
	onChange: (data: IServiceConfiguration & { isValid?: boolean; errors?: any }) => void;
	onValidation?: (isValid: boolean) => void;
}

export default function LBInputForm({ initialData, isEdit = false, onChange, onValidation }: LBInputFormProps & { initialData?: Partial<IServiceConfiguration>; isEdit?: boolean }) {
	// Initialize form data with initialData (same pattern as EndpointInputForm)
	const [formData, setFormData] = React.useState<IServiceConfiguration>({
		serviceArguments: {
			// Spread initialData first
			...initialData?.serviceArguments,
			// Then apply defaults (these will override the spread values)
			externalIP: initialData?.serviceArguments?.externalIP || '',
			port: initialData?.serviceArguments?.port || 0,
			protocol: initialData?.serviceArguments?.protocol || 'tcp',
			name: initialData?.serviceArguments?.name || '',
			sel: initialData?.serviceArguments?.sel ?? 0,
			mode: initialData?.serviceArguments?.mode ?? 0,
			monitor: initialData?.serviceArguments?.monitor || false,
			probetype: initialData?.serviceArguments?.probetype || '',
			// Filter out -1 sentinel values for health check fields
			probeport: (initialData?.serviceArguments?.probeport && initialData.serviceArguments.probeport !== -1) ? initialData.serviceArguments.probeport : undefined,
			probereq: initialData?.serviceArguments?.probereq || '',
			proberesp: initialData?.serviceArguments?.proberesp || '',
			probeTimeout: initialData?.serviceArguments?.probeTimeout || 1800,
			probeRetries: (initialData?.serviceArguments?.probeRetries && initialData.serviceArguments.probeRetries !== -1) ? initialData.serviceArguments.probeRetries : undefined,
			block: initialData?.serviceArguments?.block ?? 0,
			inactiveTimeOut: initialData?.serviceArguments?.inactiveTimeOut ?? 0,
			// New optional fields for API updates
			path_prefix: initialData?.serviceArguments?.path_prefix,
			path_match_mode: initialData?.serviceArguments?.path_match_mode,
			backend_protocol: initialData?.serviceArguments?.backend_protocol,
		},
		secondaryIPs: initialData?.secondaryIPs || [],
		allowedSources: initialData?.allowedSources || [],
		endpoints: initialData?.endpoints || [],
	});

	// Get params for validation (still use useFormWithParams for param definitions)
	const {params} = useFormWithParams<IServiceConfiguration>('IServiceConfiguration');

	// Derive validation from formData (no setState-in-effect — that pattern caused
	// an infinite render loop / "Maximum update depth exceeded"). The gateway
	// LoadbalanceEntry key is externalIP+port+protocol and each endpoint requires
	// endpointIP+targetPort+weight, so gate on those rather than name/IP alone.
	const {errors, isValid} = React.useMemo(() => {
		const e: Record<string, string> = {};
		const sa = formData.serviceArguments;
		const isPort = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 65535;

		if (!sa?.name?.trim()) e.name = t('Service Name is required');

		if (!sa?.externalIP?.trim()) e.externalIP = t('External IP is required');
		else if (!isValidIPAddress(sa.externalIP.trim())) e.externalIP = t('Enter a valid IP address');

		// port is the composite key with externalIP+protocol; required 1-65535.
		if (!isPort(sa?.port)) e.port = t('Port must be between 1 and 65535');

		// portMax is optional, but when set must be a valid port >= port (range).
		if (sa?.portMax !== undefined && sa.portMax !== null && (sa.portMax as number) !== 0) {
			if (!isPort(sa.portMax)) e.portMax = t('Port Max must be between 1 and 65535');
			else if (isPort(sa?.port) && (sa.portMax as number) < (sa.port as number)) e.portMax = t('Port Max must be greater than or equal to Port Min');
		}

		// At least one endpoint, each with a valid IP, target port and weight.
		const eps = formData.endpoints ?? [];
		if (eps.length === 0) e.endpoints = t('At least one endpoint is required');
		else {
			const bad = eps.some(ep => !ep.endpointIP?.trim() || !isValidIPAddress(ep.endpointIP.trim()) || !isPort(ep.targetPort) || !(typeof ep.weight === 'number' && ep.weight >= 1));
			if (bad) e.endpoints = t('Each endpoint needs a valid IP, target port (1-65535) and weight (>= 1)');
		}

		return {errors: e, isValid: Object.keys(e).length === 0};
	}, [formData]);

	// Notify the parent via refs so callback identity does not drive the effect
	// (another loop source). Runs only when the derived state actually changes.
	const onChangeRef = React.useRef(onChange);
	const onValidationRef = React.useRef(onValidation);
	onChangeRef.current = onChange;
	onValidationRef.current = onValidation;

	React.useEffect(() => {
		onChangeRef.current({...formData, isValid, errors});
		onValidationRef.current?.(isValid);
	}, [formData, isValid, errors]);

	// Stable per-field change handlers. Passing a fresh closure each render
	// (`handleChange('field')` re-invoked in JSX) gave every child sub-form a
	// NEW onChange identity per render; child effects that depend on `onChange`
	// (e.g. BasicSettingsForm) then re-fired every render → setState →
	// "Maximum update depth exceeded" (F14). Memoizing keeps onChange identity
	// stable so child effects only run on real value changes.
	// serviceArguments updates are DELTAS merged over prev: at dialog mount
	// several enum dropdowns auto-announce their defaults in the same effects
	// flush, and when each sent a full {...staleSA, field} snapshot the last
	// write clobbered the others (e.g. backend_protocol wiped by kvHashAlgo) —
	// and MUI Select never re-fires onChange for the already-displayed value,
	// so a clobbered field could never reach the POST payload afterwards.
	const handleServiceArguments = React.useCallback(
		(delta: any) => setFormData(prev => ({...prev, serviceArguments: {...prev.serviceArguments, ...delta}})),
		[],
	);
	const handleSecondaryIPs = React.useCallback((value: any) => setFormData(prev => ({...prev, secondaryIPs: value})), []);
	const handleAllowedSources = React.useCallback((value: any) => setFormData(prev => ({...prev, allowedSources: value})), []);
	const handleEndpoints = React.useCallback((value: any) => setFormData(prev => ({...prev, endpoints: value})), []);

	// Don't render until params are loaded to avoid issues
	if (!params) {
		return null;
	}

	return (
		<Stack width="100%" maxHeight="400px" spacing={2}>
			<Typography variant="h6">
				{isEdit ? t('Edit Load Balancer Rule') : t('Add Load Balancer Rule')}
			</Typography>

			<Stack width="100%" height="100%" padding="15px 5px" spacing={2} sx={{overflowY: 'auto'}}>
			   <BasicSettingsForm
			   	value={formData?.serviceArguments ?? {}}
			   	onChange={handleServiceArguments}
			   	params={params?.serviceArguments}
			   	isEdit={isEdit}
			   />
			   <AdvancedSettingsForm value={formData?.serviceArguments ?? {}} onChange={handleServiceArguments} params={params?.serviceArguments} />
				   <AIGatewaySettingsForm value={formData?.serviceArguments ?? {}} onChange={handleServiceArguments} params={params?.serviceArguments} />
			   <SecondaryIPListInputForm values={formData?.secondaryIPs ?? []} onChange={handleSecondaryIPs} description={params?.secondaryIPs?.description} />
			   <AllowedSourcesListInputForm values={formData?.allowedSources ?? []} onChange={handleAllowedSources} description={params?.allowedSources?.description} />
			   <EndpointListForm
					values={formData?.endpoints ?? []}
					onChange={handleEndpoints}
					params={params?.endpoints}
					serviceArguments={formData?.serviceArguments}
					onServiceArgumentsChange={handleServiceArguments}
					serviceArgumentsParams={params?.serviceArguments}
			   />
			   {/* <HealthCheckForm value={formData?.serviceArguments ?? {}} onChange={handleChange('serviceArguments')} params={params?.serviceArguments} /> */}
			   {/* Health check fields moved to EndpointListForm */}
			</Stack>
		</Stack>
	);
}