//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack, Typography} from '@mui/material';
import {t} from 'i18next';
import {ReactNode} from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
// `isEdit` is OPTIONAL and defaults to the historical "New …" heading, because
// this box is shared by twenty-odd forms that render it in both modes and
// changing the default would retitle all of them at once. Pass it where the
// form actually knows which operation it is performing: a dialog headed "New"
// while it edits an existing item tells the operator they are creating a
// second one.
export default function NewBox(props: {item_name: string; isEdit?: boolean; children?: ReactNode}) {
	const {item_name, isEdit = false, children} = props;

	return (
		<Box display="flex" flexDirection="column" gap={4}>
			{/* ⚠️ `component` is load-bearing: this is the heading ten e2e specs
			    locate a dialog by (`getByRole('heading', {name: 'New …'})`), so it must
			    stay a heading. h2 rather than the variant's implied h6 — it sits
			    directly under the layout's h1 (see RouteTitle PageHeading). */}
			<Typography variant="h6" component="h2" color="text.secondary">
				{isEdit ? t('Edit {{item_name}}', {item_name}) : t('New {{item_name}}', {item_name})}
			</Typography>

			<Stack spacing={2} width="100%">
				{children}
			</Stack>
		</Box>
	);
}
