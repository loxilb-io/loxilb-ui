//---------------------------------------------------------
// Mirror destination port vs. the late port list
// (npm test src/components/input/MirrorInputForm.test.tsx)
//
// The Port field is free text until /config/port/all answers, then a select
// whose first entry is auto-chosen for an EMPTY port. A port the operator
// already typed must survive the list's arrival: the create must carry the
// typed port, not the list's first entry.
//---------------------------------------------------------
import MirrorInputForm from 'components/input/MirrorInputForm';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import 'locales/i18n';

// The /config/mirror fields exactly as the gateway's /meta shapes them
// (nested objects carry their fields directly, no type/properties wrapper).
const MIRROR_PARAMS = {
	mirrorIdent: {type: 'string', required: true, description: 'Mirror name'},
	mirrorInfo: {
		port: {type: 'string', required: false, description: 'Port where mirrored traffic needs to be sent'},
		remoteIP: {type: 'string', required: false, description: 'ERSPAN remote IP'},
		sourceIP: {type: 'string', required: false, description: 'ERSPAN source IP'},
		tunnelID: {type: 'integer', required: false, description: 'ERSPAN tunnel identifier'},
		type: {type: 'integer', required: false, enum: [0, 1, 2], description: 'Mirror type'},
		vlan: {type: 'integer', required: false, description: 'Mirror VLAN'},
	},
	targetObject: {
		attachment: {type: 'integer', required: true, enum: [0, 1], description: 'Attachment selector'},
		mirrObjName: {type: 'string', required: true, description: 'Target Names'},
	},
};

// Stable identities, as React Query hands back: a fresh array per render
// would re-fire every list-keyed effect and never settle.
const NO_RULES: never[] = [];
const PORT_LIST = [
	{portName: 'vlan3807', portNo: 1},
	{portName: 'vlan3843', portNo: 2},
];
let ports: typeof PORT_LIST | undefined;
const METADATA = {is_fetched: true, param_fields: MIRROR_PARAMS, get_param: () => MIRROR_PARAMS};

const INST = {id: 1, name: 'gw'};
vi.mock('hooks/instanceHook', () => ({useInstanceFromURL: () => INST}));
vi.mock('hooks/query/queryHooks', () => ({
	useMetadata: () => METADATA,
	usePortAttr: () => ({data: ports}),
	useLoadBalancerConfig: () => ({data: NO_RULES}),
}));

beforeEach(() => {
	ports = undefined;
});
afterEach(() => cleanup());

const lastCall = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1][0];

describe('MirrorInputForm destination port', () => {
	it('keeps a port typed before the port list arrives', () => {
		const onChange = vi.fn();
		const {rerender} = render(<MirrorInputForm onChange={onChange} />);

		fireEvent.change(screen.getByLabelText(/^Port( \*)?$/), {target: {value: 'vlan3843'}});
		expect(lastCall(onChange).mirrorInfo.port).toBe('vlan3843');

		ports = PORT_LIST;
		act(() => rerender(<MirrorInputForm onChange={onChange} />));

		expect(lastCall(onChange).mirrorInfo.port).toBe('vlan3843');
	});

	it('still defaults an untouched port to the first listed one', () => {
		const onChange = vi.fn();
		const {rerender} = render(<MirrorInputForm onChange={onChange} />);

		ports = PORT_LIST;
		act(() => rerender(<MirrorInputForm onChange={onChange} />));

		expect(lastCall(onChange).mirrorInfo.port).toBe('vlan3807');
	});
});
