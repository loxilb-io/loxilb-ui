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
import {useTranslation} from 'react-i18next';
import {useRef, useState, useEffect} from 'react';
import {IInstanceInput} from 'types/oam';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function InstanceCardAdd() {
	const [is_hover, set_is_hover] = useState(false);
	const [loading, setLoading] = useState(false);
	const {openPopUp, enableYes} = usePopUp();
	const {refetch} = useInstances();
	const { t, i18n } = useTranslation();
	const [languageKey, setLanguageKey] = useState(0);

	const instanceRef = useRef<IInstanceInput | null>(null);

	const handleAdd = () => {
		const input_form = <InstanceInputForm key={Date.now()} onChange={data => {
			instanceRef.current = data;
			enableYes(data.isValid && !loading);
		}} />;

		openPopUp(t('Add New Instance'), input_form, t('Create'), t('Cancel'), async () => {
			if (instanceRef.current) {
				setLoading(true);
				enableYes(false); // Disable during loading
				try {
					const res = await request_create_instance(instanceRef.current);
					if (res.status === 'success') {
						openPopUp(t('Success'), t('Instance created successfully.'), t('OK'));
						refetch();
					} else {
						openPopUp(t('Error'), t('Failed to create instance. {{error}}', {error: res.error}), t('OK'));
					}
				} catch (err) {
					const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
					openPopUp(t('Error'), t('Failed to create instance. {{error}}', {error: errorMessage}), t('OK'));
				} finally {
					setLoading(false);
				}
			}
		}, true); // Start with button disabled
	};

	useEffect(() => {
		setLanguageKey(prev => prev + 1);
	}, [i18n.language]);

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