//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Tooltip} from '@mui/material';
import IPAddressBox from 'components/element/IPAddressBox';
import IPAddressCidrBox from 'components/element/IPAddressNetBox';
import PortBox from 'components/element/PortBox';
import TextBox from 'components/element/TextBox';
import TextBoxArray from 'components/element/TextBoxArray';
import {useMemo, useEffect} from 'react';
import {IEnumItem, IPostParamFieldDesc} from 'types/global';
import DropDownSelectBox from './DropDownSelectBox';
import MACAddressBox from './MACAddressBox';
import SwitchBox from './SwitchBox';

//---------------------------------------------------------
// Component
//---------------------------------------------------------

interface ParamBoxProps {
   label: string;
   value: any;
   param_desc?: IPostParamFieldDesc;
   width?: string;
   multiline?: boolean;
   minRows?: number;
   disabled?: boolean;
   onChange: (val: any) => void;
   error?: boolean;
   helperText?: string;
   onValidation?: (isValid: boolean) => void;
}

export function shouldAutoSelectEnumDefault(enumOptions: IEnumItem[], value: unknown, disabled?: boolean): boolean {
   return !disabled && enumOptions.length > 0 && (value === undefined || value === '' || value === null);
}

export default function ParamBox(props: ParamBoxProps) {
   const {label, value, param_desc, onChange, width, multiline, minRows, disabled, error, helperText, onValidation} = props;
   const type = param_desc?.type ?? (typeof value === 'number' ? 'integer' : typeof value === 'boolean' ? 'boolean' : 'string');
   const format = param_desc?.format;
   const description = param_desc?.description;
   const required = param_desc?.required ?? false;
   // Show red asterisk for required fields
   const labelText = required ? `${label} *` : label;


   // Show 'Required' helper text if field is required and empty
   const showRequiredHelper = required && (value === undefined || value === '' || value === null);
   const finalHelperText = showRequiredHelper ? 'Required' : helperText;

   const handleChange = (newValue: any) => onChange(newValue);

   const enumOptions: IEnumItem[] = useMemo<IEnumItem[]>(() => {
      	const value_list = param_desc?.enum as string[] | IEnumItem[] | undefined;

		// Notify parent about validation state (for popup dialog control)
		if (onValidation) {
			onValidation(!(!!error || showRequiredHelper));
		}
		const result: IEnumItem[] = [];
		if (!value_list || value_list.length === 0) return [];
		else if (typeof value_list[0] === 'string' || typeof value_list[0] === 'number') {
			// Gateway metadata enums can be plain numbers; without this branch
			// they fell into the IEnumItem path and rendered BLANK option names.
			result.push(
				...(value_list as (string | number)[]).map((item, index) => ({
				id: index,
				name: String(item),
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

		return result;
   }, [param_desc?.enum, required]);

   // If enumOptions exist and value is empty/undefined, default to first option
   const effectiveValue = useMemo(() => {
	   if (enumOptions.length > 0 && (value === undefined || value === '' || value === null)) {
		   return enumOptions[0].send_value;
	   }
	   return value;
   }, [enumOptions, value]);

   // Notify parent when auto-selecting default value. `value` must be a dep:
   // when the metadata query resolves, useFormWithParams resets the form to
   // schema defaults, wiping a mount-time auto-default — the value flipping
   // back to empty must re-announce it (converges: once the parent applies
   // the default, value is non-empty and the effect stops firing).
   useEffect(() => {
      if (shouldAutoSelectEnumDefault(enumOptions, value, disabled)) {
         onChange(enumOptions[0].send_value);
      }
   }, [disabled, enumOptions.length, value]);

   const renderInput = () => {
	if (enumOptions.length > 0) 
		return <DropDownSelectBox label={labelText} item_list={enumOptions} value={effectiveValue} disabled={disabled} onChange={handleChange} />;
	else if (type === 'boolean') 
		return <SwitchBox label={labelText} value={value} disabled={disabled} onChange={handleChange} />;
	else if (type === 'array')
		return <TextBoxArray label={labelText} value={value} type={param_desc?.items?.type === 'integer' ? 'number' : 'string'} onChange={handleChange} />;
	else if (type === 'ipaddress') 
		return <IPAddressBox label={labelText} value={value} disabled={disabled} error={!!error || showRequiredHelper} helperText={finalHelperText} onChange={handleChange} />;	
	else if (type === 'ipaddress_cidr') 
		return <IPAddressCidrBox label={labelText} value={value} disabled={disabled} error={!!error || showRequiredHelper} helperText={finalHelperText} onChange={handleChange} />;
	else if (type === 'port') 
		return <PortBox label={labelText} value={value} disabled={disabled} error={!!error || showRequiredHelper} helperText={finalHelperText} onChange={handleChange} />;
	else if (type === 'macaddress') 
		return <MACAddressBox label={labelText} value={value} disabled={disabled} onChange={handleChange} error={!!error || showRequiredHelper} helperText={finalHelperText}/>;
	else 
		return <TextBox label={labelText} value={value} type={type} format={format} disabled={disabled} multiline={multiline} minRows={minRows} onChange={handleChange} error={!!error || showRequiredHelper} helperText={finalHelperText} />;
   };

   return (
      <Tooltip title={description ?? ''} arrow placement="top" leaveDelay={0} disableInteractive>
         <Box width={width || '100%'}>{renderInput()}</Box>
      </Tooltip>
   );
}
