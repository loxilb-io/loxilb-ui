//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Grid2, Stack} from '@mui/material';
import {isValidIPAddress, isValidIPAddressCidr} from 'common';
import NewBox from 'components/layout/NewBox';
import ParamBox from 'components/element/ParamBox';
import {t} from 'i18next';
import {IIPFilterEntry} from 'types/security';
import React from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface IPFilterInputFormProps {
	value?: IIPFilterEntry;
	onChange: (data: IIPFilterEntry & {isValid?: boolean}) => void;
}

export default function IPFilterInputForm(props: IPFilterInputFormProps) {
	const {onChange} = props;

	const [form, setForm] = React.useState<IIPFilterEntry>({
		filterType: 'whitelist',
		cidr: '',
		zone: 0,
		priority: 100,
		action: 'allow',
	});

	const handleChange = (field: keyof IIPFilterEntry) => (value: any) => {
		const newForm = {...form, [field]: value};
		// The datapath only acts on whitelist+allow and blacklist+drop; the
		// gateway rejects the other two pairings. Keep action in step with the
		// filter type so the common flow can never build an invalid pairing.
		if (field === 'filterType') {
			newForm.action = value === 'whitelist' ? 'allow' : 'drop';
		}
		setForm(newForm);
		onChange({...newForm, isValid: validateForm(newForm)});
	};

	const validateForm = (data: IIPFilterEntry): boolean => {
		// CIDR is required
		if (!data.cidr || data.cidr.trim() === '') return false;

		// Accept a bare IP or a CIDR, but reject out-of-range octets and
		// prefixes (the old regex let 999.1.1.1 and /33 through).
		const cidr = data.cidr.trim();
		if (!isValidIPAddress(cidr) && !isValidIPAddressCidr(cidr)) return false;

		// Priority should be positive
		if (data.priority !== undefined && data.priority < 0) return false;

		// Zone should be non-negative
		if (data.zone !== undefined && data.zone < 0) return false;

		// Whitelist must allow, blacklist must drop (gateway rejects otherwise).
		const validPairing =
			(data.filterType === 'whitelist' && data.action === 'allow') ||
			(data.filterType === 'blacklist' && data.action === 'drop');
		if (!validPairing) return false;

		return true;
	};

	React.useEffect(() => {
		onChange({...form, isValid: validateForm(form)});
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, []);

	return (
		<NewBox item_name={t('IP Filter Rule Configuration')}>
			<Stack spacing={3}>
				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Filter Type')}
						value={form.filterType}
						onChange={(value: string) => handleChange('filterType')(value as 'whitelist' | 'blacklist')}
						param_desc={{
							type: 'string',
							description: 'Filter type (whitelist or blacklist)',
							required: true,
							enum: ['whitelist', 'blacklist'],
						}}
					/>

					<ParamBox
						label={t('CIDR')}
						value={form.cidr}
						onChange={(value: string) => handleChange('cidr')(value)}
						param_desc={{
							type: 'string',
							description: 'IP address in CIDR notation (e.g., 192.168.1.0/24)',
							required: true,
						}}
					/>
				</Grid2>

				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Action')}
						value={form.action}
						onChange={(value: string) => handleChange('action')(value as 'allow' | 'drop')}
						param_desc={{
							type: 'string',
							description: 'Action to take (allow or drop)',
							required: true,
							enum: ['allow', 'drop'],
						}}
					/>

					<ParamBox
						label={t('Priority')}
						value={form.priority?.toString() ?? '100'}
						onChange={(value: string) => handleChange('priority')(parseInt(value) || 100)}
						param_desc={{
							type: 'integer',
							description: 'Rule priority (higher = more important)',
						}}
					/>
				</Grid2>

				{/*
				  * Security Zone is intentionally not exposed: the gateway's XDP
				  * ipfilter is zone-less and rejects any nonzero zone with 400
				  * ("zone must be 0 or omitted"). `zone` stays pinned to 0 in form
				  * state so the payload is always accepted; surfacing it as an
				  * editable field only produced guaranteed-to-fail submissions.
				  */}
			</Stack>
		</NewBox>
	);
}
