//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Add} from '@mui/icons-material';
import {Box, Button, Stack} from '@mui/material';
import AccordionBox from 'components/element/AccordionBox';
import ParamBox from 'components/element/ParamBox';
import SimpleButton from 'components/element/SimpleButton';
import {t} from 'i18next';
import {useState} from 'react';
import {IAllowedSource, ISecondaryIP} from 'types/load_balancer';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export function SecondaryIPListInputForm(props: {values: ISecondaryIP[]; onChange: (values: ISecondaryIP[]) => void; description?: string}) {
	const {values, onChange, description} = props;

	const [ip_list, set_ip_list] = useState<string[]>([]);

	const handleChange = (val: string) => {
		if (!val) return;
		const trimmedVal = val.trim();
		const newList = [...ip_list];
		newList[newList.length - 1] = trimmedVal; // Update the last item
		set_ip_list(newList);
		onChange(newList.map(ip => ({secondaryIP: ip})));
	};

	const handleAdd = () => {
		set_ip_list([...ip_list, '']);
		onChange([...values, {secondaryIP: ''}]);
	};

	const handleDelete = (index: number) => {
		const newList = ip_list.filter((_, i) => i !== index);
		set_ip_list(newList);
		onChange(newList.map(ip => ({secondaryIP: ip})));
	};

	return (
		<AccordionBox title={t('Secondary IPs')} tooltip={description}>
			<Stack spacing={2}>
				<Stack spacing={2}>
					{ip_list.map((item, index) => (
						<Box border={'1px solid #ccc'} borderRadius={2} padding={2} key={index}>
							<Stack spacing={1} direction="row" justifyContent="space-between" alignItems="center">
								<ParamBox label={t('IP Address')} value={item} onChange={handleChange} param_desc={{type: 'ipaddress'}} />
								<SimpleButton type="delete" onClick={() => handleDelete(index)} />
							</Stack>
						</Box>
					))}
				</Stack>

				<Button variant="outlined" startIcon={<Add />} size="small" sx={{width: 'fit-content'}} onClick={handleAdd}>
					{t('Add')}
				</Button>
			</Stack>
		</AccordionBox>
	);
}

export function AllowedSourcesListInputForm(props: {values: IAllowedSource[]; onChange: (values: IAllowedSource[]) => void; description?: string}) {
	const {values, onChange, description} = props;

	const [ip_list, set_ip_list] = useState<string[]>([]);

	const handleChange = (val: string) => {
		if (!val) return;
		const trimmedVal = val.trim();
		const newList = [...ip_list];
		newList[newList.length - 1] = trimmedVal;
		set_ip_list(newList);
		onChange(newList.map(ip => ({prefix: ip})));
	};

	const handleAdd = () => {
		set_ip_list([...ip_list, '']);
		onChange([...values, {prefix: ''}]);
	};

	const handleDelete = (index: number) => {
		const newList = ip_list.filter((_, i) => i !== index);
		set_ip_list(newList);
		onChange(newList.map(ip => ({prefix: ip})));
	};

	return (
		<AccordionBox title={t('Allowed Sources')} tooltip={description}>
			<Stack spacing={2}>
				<Stack spacing={2}>
					{ip_list.map((item, index) => (
						<Box border={'1px solid #ccc'} borderRadius={2} padding={2} key={index}>
							<Stack spacing={1} direction="row" justifyContent="space-between" alignItems="center">
								<ParamBox label={t('IP Address')} value={item} onChange={handleChange} param_desc={{type: 'ipaddress'}} />
								<SimpleButton type="delete" onClick={() => handleDelete(index)} />
							</Stack>
						</Box>
					))}
				</Stack>

				<Button variant="outlined" startIcon={<Add />} size="small" sx={{width: 'fit-content'}} onClick={handleAdd}>
					{t('Add')}
				</Button>
			</Stack>
		</AccordionBox>
	);
}
