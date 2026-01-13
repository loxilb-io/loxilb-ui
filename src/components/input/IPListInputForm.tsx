//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Add} from '@mui/icons-material';
import {Box, Button, Stack} from '@mui/material';
import AccordionBox from 'components/element/AccordionBox';
import ParamBox from 'components/element/ParamBox';
import SimpleButton from 'components/element/SimpleButton';
import {t} from 'i18next';
import {useState, useEffect} from 'react';
import {IAllowedSource, ISecondaryIP} from 'types/load_balancer';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export function SecondaryIPListInputForm(props: {values: ISecondaryIP[]; onChange: (values: ISecondaryIP[]) => void; description?: string}) {
	const {values, onChange, description} = props;

   const [ip_list, set_ip_list] = useState<string[]>(() => (Array.isArray(values) ? values.map(v => v?.secondaryIP ?? '') : []));

   // Sync ip_list with values when props.values changes
   useEffect(() => {
	   set_ip_list(Array.isArray(values) ? values.map(v => v?.secondaryIP ?? '') : []);
   }, [values]);

   const handleChange = (val: string, index: number) => {
	   const trimmedVal = (val ?? '').trim();
	   const newList = [...ip_list];
	   newList[index] = trimmedVal;
	   set_ip_list(newList);
	   // Filter out empty values before passing to parent
	   onChange(newList.filter(ip => ip.trim() !== '').map(ip => ({secondaryIP: ip})));
   };

   const handleAdd = () => {
	   const newList = [...ip_list, ''];
	   set_ip_list(newList);
	   // Don't call onChange here - wait for user to fill in the value
   };

   const handleDelete = (index: number) => {
	   const newList = ip_list.filter((_, i) => i !== index);
	   set_ip_list(newList);
	   // Filter out empty values before passing to parent
	   onChange(newList.filter(ip => ip.trim() !== '').map(ip => ({secondaryIP: ip})));
   };

   return (
	   <AccordionBox title={t('Secondary IPs')} tooltip={"Define the list of secondary IP addresses for this Load Balancer"}>
		   <Stack spacing={2}>
			   <Stack spacing={2}>
				   {ip_list.map((item, index) => (
					   <Box border={'1px solid #ccc'} borderRadius={2} padding={2} key={index}>
						   <Stack spacing={1} direction="row" justifyContent="space-between" alignItems="center">
							   <ParamBox label={t('IP Address')} value={item ?? ''} onChange={val => handleChange(val, index)} param_desc={{type: 'ipaddress'}} />
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

   const [ip_list, set_ip_list] = useState<string[]>(() => (Array.isArray(values) ? values.map(v => v?.prefix ?? '') : []));

   // Sync ip_list with values when props.values changes
   useEffect(() => {
	   set_ip_list(Array.isArray(values) ? values.map(v => v?.prefix ?? '') : []);
   }, [values]);

   const handleChange = (val: string, index: number) => {
	   const trimmedVal = (val ?? '').trim();
	   const newList = [...ip_list];
	   newList[index] = trimmedVal;
	   set_ip_list(newList);
	   // Filter out empty values before passing to parent
	   onChange(newList.filter(ip => ip.trim() !== '').map(ip => ({prefix: ip})));
   };

   const handleAdd = () => {
	   const newList = [...ip_list, ''];
	   set_ip_list(newList);
	   // Don't call onChange here - wait for user to fill in the value
   };

   const handleDelete = (index: number) => {
	   const newList = ip_list.filter((_, i) => i !== index);
	   set_ip_list(newList);
	   // Filter out empty values before passing to parent
	   onChange(newList.filter(ip => ip.trim() !== '').map(ip => ({prefix: ip})));
   };

   return (
	   <AccordionBox title={t('Allowed Sources')} tooltip={"Define the list of allowed source IP addresses for this Load Balancer"}>
		   <Stack spacing={2}>
			   <Stack spacing={2}>
				   {ip_list.map((item, index) => (
					   <Box border={'1px solid #ccc'} borderRadius={2} padding={2} key={index}>
						   <Stack spacing={1} direction="row" justifyContent="space-between" alignItems="center">
							   <ParamBox label={t('IP Address')} value={item ?? ''} onChange={val => handleChange(val, index)} param_desc={{type: 'ipaddress_cidr'}} />
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
