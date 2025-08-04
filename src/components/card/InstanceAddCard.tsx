//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import AddIcon from '@mui/icons-material/Add';
import {Box, Card, CardContent, Typography} from '@mui/material';
import ImageInstance from 'assets/image/instance.svg';
import InstanceInputForm from 'components/input/InstanceInputForm';
import {request_create_instance} from 'connector/oam/oam';
import {usePopUp} from 'hooks/popupHook';
import {useInstances} from 'hooks/query/oamHooks';
import {t} from 'i18next';
import {useRef, useState} from 'react';
import {IInstanceInput} from 'types/oam';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function InstanceCardAdd() {
	const [is_hover, set_is_hover] = useState(false);
	const {openPopUp} = usePopUp();
	const {refetch} = useInstances();

	const instanceRef = useRef<IInstanceInput | null>(null);

	const handleAdd = () => {
		const input_form = <InstanceInputForm key={Date.now()} onChange={data => (instanceRef.current = data)} />;

		openPopUp(t('Add New Instance'), input_form, t('Create'), t('Cancel'), async () => {
			if (instanceRef.current) {
				const res = await request_create_instance(instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					refetch();
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			}
		});
	};

	return (
		<Card
			onMouseOver={() => set_is_hover(true)}
			onMouseOut={() => set_is_hover(false)}
			sx={{width: '260px', height: '400px', borderColor: 'secondary.light', borderWidth: '2px', userSelect: 'none', cursor: 'pointer'}}
			variant="outlined"
		>
			<CardContent sx={{height: '100%'}} onClick={handleAdd}>
				<Box width="100%" height="100%" display="flex" flexDirection="column" justifyContent="center" alignItems="center" gap="20px">
					<Box component="img" src={ImageInstance} width="40px" />

					<Typography variant="subtitle1" color="secondary.main">
						{t('Add New Instance')}
					</Typography>

					<AddIcon sx={{color: is_hover ? 'secondary.main' : 'grey.400'}} />
				</Box>
			</CardContent>
		</Card>
	);
}
