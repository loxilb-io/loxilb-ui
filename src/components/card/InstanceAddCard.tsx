//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import AddIcon from '@mui/icons-material/Add';
import {Box, Card, CardContent, Typography} from '@mui/material';
import ImageInstance from 'assets/image/instance.svg';
import InstanceInputForm from 'components/input/InstanceInputForm';
import {describe_instance_error, TInstanceFormData} from 'components/input/instanceFormLogic';
import {request_create_instance} from 'connector/oam/oam';
import {usePopUp} from 'hooks/popupHook';
import {useInstances} from 'hooks/query/oamHooks';
import {useTranslation} from 'react-i18next';
import {useRef, useState} from 'react';
import {IInstanceInput} from 'types/oam';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function InstanceCardAdd() {
	const [is_hover, set_is_hover] = useState(false);
	const [loading, setLoading] = useState(false);
	const {openPopUp, enableYes} = usePopUp();
	const {instance_list, refetch} = useInstances();
	const {t} = useTranslation();

	const instanceRef = useRef<TInstanceFormData | null>(null);
	// The submit handler runs long after the dialog was built, so it must read
	// the CURRENT list/loading state, not the ones captured at open time.
	const instanceListRef = useRef(instance_list);
	instanceListRef.current = instance_list;

	const handleAdd = () => {
		if (loading) return;
		instanceRef.current = null;

		const input_form = (
			<InstanceInputForm
				key={Date.now()}
				existing={instanceListRef.current}
				onChange={data => {
					instanceRef.current = data;
					enableYes(data.isValid);
				}}
			/>
		);

		openPopUp(
			t('Add New Instance'),
			input_form,
			t('Create'),
			t('Cancel'),
			async () => {
				if (!instanceRef.current) return;
				// Belt-and-braces: the dialog's Create button is gated on
				// validity, but never POST an invalid body if that gate is
				// ever bypassed (stale enableYes, keyboard submit).
				if (!instanceRef.current.isValid) {
					openPopUp(t('Error'), t('Please correct the highlighted fields.'), t('OK'));
					return;
				}
				setLoading(true);
				enableYes(false); // Disable during loading
				try {
					const {isValid, errors, ...payload} = instanceRef.current;
					const res = await request_create_instance(payload);
					if (res.status === 'success') {
						openPopUp(t('Success'), t('Instance created successfully.'), t('OK'));
						refetch();
					} else {
						openPopUp(t('Error'), t('Failed to create instance. {{error}}', {error: describe_instance_error(res.error)}), t('OK'));
					}
				} catch (err) {
					const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
					openPopUp(t('Error'), t('Failed to create instance. {{error}}', {error: errorMessage}), t('OK'));
				} finally {
					setLoading(false);
				}
			},
			true,
		); // Start with button disabled
	};

	return (
		<Card
			onMouseOver={() => set_is_hover(true)}
			onMouseOut={() => set_is_hover(false)}
			sx={{width: '260px', height: '400px', borderColor: 'secondary.light', borderWidth: '2px', userSelect: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1}}
			variant="outlined"
		>
			<CardContent sx={{height: '100%'}} onClick={loading ? undefined : handleAdd}>
				<Box width="100%" height="100%" display="flex" flexDirection="column" justifyContent="center" alignItems="center" gap="20px">
					<Box component="img" src={ImageInstance} width="40px" />

					{/* Navy, not orange: subtitle1 is below the large-text size where
						the brand orange clears AA contrast (usage rule). */}
					<Typography variant="subtitle1" color="primary.main">
						{loading ? t('Creating...') : t('Add New Instance')}
					</Typography>

					<AddIcon sx={{color: is_hover && !loading ? 'secondary.main' : 'grey.400'}} />
				</Box>
			</CardContent>
		</Card>
	);
}
