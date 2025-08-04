//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Tooltip} from '@mui/material';
import IPAddressBox from 'components/element/IPAddressBox';
import PortBox from 'components/element/PortBox';
import TextBox from 'components/element/TextBox';
import TextBoxArray from 'components/element/TextBoxArray';
import {useMemo} from 'react';
import {IEnumItem, IPostParamFieldDesc} from 'types/global';
import DropDownSelectBox from './DropDownSelectBox';
import MACAddressBox from './MACAddressBox';
import SwitchBox from './SwitchBox';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function ParamBox(props: {
	label: string;
	value: any;
	param_desc?: IPostParamFieldDesc;
	width?: string;
	multiline?: boolean;
	minRows?: number;
	disabled?: boolean;
	onChange: (val: any) => void;
}) {
	const {label, value, param_desc, onChange, width, multiline, minRows, disabled} = props;

	const type = param_desc?.type ?? (typeof value === 'number' ? 'integer' : typeof value === 'boolean' ? 'boolean' : 'string');
	const format = param_desc?.format;
	const description = param_desc?.description;
	const required = param_desc?.required ?? false;
	const labelText = required ? `${label} *` : label;

	const handleChange = (newValue: any) => onChange(newValue);

	const enumOptions: IEnumItem[] = useMemo<IEnumItem[]>(() => {
		const value_list = param_desc?.enum as string[] | IEnumItem[] | undefined;

		const result: IEnumItem[] = [];
		if (!value_list || value_list.length === 0) return [];
		else if (typeof value_list[0] === 'string') {
			result.push(
				...(value_list as string[]).map((item, index) => ({
					id: index,
					name: item,
					send_value: item,
				})),
			);
		} else {
			result.push(
				...(value_list as IEnumItem[]).map((item: IEnumItem, index: number) => ({
					id: item.id ?? index,
					name: item.name,
					send_value: item.send_value ?? item.name,
				})),
			);
		}

		// !!! none이 누락이면 none을 인덱스 -1로 추가
		if (!required && !result.some(item => item.name === 'none') && !result.some(item => item.send_value === ''))
			result.unshift({id: -1, name: 'none', send_value: typeof result[0].send_value === 'number' ? -1 : '-1'});

		return result;
	}, [param_desc?.enum, required]);

	const renderInput = () => {
		if (enumOptions.length > 0) return <DropDownSelectBox label={labelText} item_list={enumOptions} value={value} disabled={disabled} onChange={handleChange} />;
		else if (type === 'boolean') return <SwitchBox label={labelText} value={value} disabled={disabled} onChange={handleChange} />;
		else if (type === 'array')
			return <TextBoxArray label={labelText} value={value} type={param_desc?.items?.type === 'integer' ? 'number' : 'string'} onChange={handleChange} disabled={disabled} />;
		else if (type === 'ipaddress') return <IPAddressBox label={labelText} value={value} disabled={disabled} onChange={handleChange} />;
		else if (type === 'port') return <PortBox label={labelText} value={value} disabled={disabled} onChange={handleChange} />;
		else if (type === 'macaddress') return <MACAddressBox label={labelText} value={value} disabled={disabled} onChange={handleChange} />;
		else return <TextBox label={labelText} value={value} type={type} format={format} disabled={disabled} multiline={multiline} minRows={minRows} onChange={handleChange} />;
	};

	return (
		<Tooltip title={description ?? ''} arrow placement="top" leaveDelay={0} disableInteractive>
			<Box width={width || '100%'}>{renderInput()}</Box>
		</Tooltip>
	);
}
