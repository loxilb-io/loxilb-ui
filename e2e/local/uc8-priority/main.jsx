// Real shared UI component and projection functions, with no backend.
import React from 'react';
import {createRoot} from 'react-dom/client';
import '../../../src/locales/i18n';
import PriorityClassFields from '../../../src/components/input/subforms/PriorityClassFields';
import {priorityDraftFrom, priorityCreateFields, priorityChangedFields} from '../../../src/types/ai_priority';

const params = new URLSearchParams(window.location.search);
const scope = ['key', 'tenant', 'jwt'].includes(params.get('scope')) ? params.get('scope') : 'key';
const initial = params.has('edit') ? {priority_class: 'critical', default_objective: 'gold', allowed_objectives: ['gold', 'batch']} : {};
function Fixture() {
	const [draft, setDraft] = React.useState(() => priorityDraftFrom(initial));
	return <main style={{padding: 24}}>
		<PriorityClassFields scope={scope} value={draft} onChange={setDraft} defaultOpen={params.has('edit')} isEdit={params.has('edit')}
			objectives={[{name: 'gold', priority: 10}, {name: 'batch', priority: -5}]} />
		<output data-testid="create-body">{JSON.stringify(priorityCreateFields(draft, scope))}</output>
		<output data-testid="change-body">{JSON.stringify(priorityChangedFields(draft, initial, scope))}</output>
	</main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
