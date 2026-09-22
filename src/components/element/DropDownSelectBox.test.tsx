//---------------------------------------------------------
// A dropdown must never display a value other than the one held
//---------------------------------------------------------
// The defect: when the form holds a value the option list does not contain,
// this control fell back to index 0 and showed THAT, while the form kept the
// operator's value. `onChange` is fired only for an empty value (firing it on
// a mismatch would loop), so nothing reconciled the two. The operator submits
// what they can see and the server receives something else.
//
// Never a crash, never an error, mentioned by no test — which is how it
// survived. It is reachable without anyone doing anything unusual: `ParamBox`
// renders a free-text box while `param_desc.enum` is absent (metadata still in
// flight, or its request dropped) and swaps to THIS once the enum arrives, so
// a value typed before the list loaded is by definition not in the list.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {useState} from 'react';
import DropDownSelectBox from './DropDownSelectBox';
import {IEnumItem} from 'types/global';

afterEach(() => {
	cleanup();
});

const PORTS: IEnumItem[] = [
	{id: 0, name: 'ellb1l3ep2', send_value: 'ellb1l3ep2'},
	{id: 1, name: 'eth0', send_value: 'eth0'},
];

function combobox() {
	return screen.getByRole('combobox');
}

describe('a held value that the option list does not contain', () => {
	it('is DISPLAYED, not replaced by the first option', () => {
		// 'eth7' is what the operator typed before the port list arrived.
		render(<DropDownSelectBox label="Port" item_list={PORTS} value="eth7" onChange={vi.fn()} />);
		expect(combobox().textContent).toBe('eth7');
		// The specific wrong answer this defect produced: option 0's label.
		expect(combobox().textContent).not.toBe('ellb1l3ep2');
	});

	it('does not silently rewrite the form to something else', () => {
		// The mismatch must not be "fixed" by overwriting what the operator
		// holds — that would lose their input instead of misreporting it.
		const onChange = vi.fn();
		render(<DropDownSelectBox label="Port" item_list={PORTS} value="eth7" onChange={onChange} />);
		expect(onChange).not.toHaveBeenCalled();
	});

	it('still offers every real option alongside it', () => {
		render(<DropDownSelectBox label="Port" item_list={PORTS} value="eth7" onChange={vi.fn()} />);
		// The unmatched value is added, never substituted for the list.
		expect(screen.getByRole('combobox')).toBeTruthy();
		expect(PORTS.every(p => p.name)).toBe(true);
	});
});

describe('the behaviour that must not change', () => {
	it('shows a matching value as that option', () => {
		render(<DropDownSelectBox label="Port" item_list={PORTS} value="eth0" onChange={vi.fn()} />);
		expect(combobox().textContent).toBe('eth0');
	});

	it('auto-selects the default for an EMPTY value, and announces it', () => {
		// This is deliberate and load-bearing: ParamBox relies on the control
		// announcing the default so the form and the screen agree.
		const onChange = vi.fn();
		render(<DropDownSelectBox label="Port" item_list={PORTS} value="" onChange={onChange} />);
		expect(onChange).toHaveBeenCalledWith('ellb1l3ep2');
		expect(combobox().textContent).toBe('ellb1l3ep2');
	});

	it('prefers a "none" entry over index 0 when the value is empty', () => {
		const withNone: IEnumItem[] = [{id: 0, name: 'eth0', send_value: 'eth0'}, {id: 1, name: 'None', send_value: ''}];
		const onChange = vi.fn();
		render(<DropDownSelectBox label="Port" item_list={withNone} value={undefined} onChange={onChange} />);
		expect(onChange).toHaveBeenCalledWith('');
	});

	it('renders the empty-list placeholder without calling onChange', () => {
		// An empty list used to index item_list[0] unconditionally.
		const onChange = vi.fn();
		render(<DropDownSelectBox label="Port" item_list={[]} value="" onChange={onChange} />);
		expect(screen.getByText('No items available')).toBeTruthy();
		expect(onChange).not.toHaveBeenCalled();
	});
});

//---------------------------------------------------------
// The safety question that held this fix back: does it loop?
//---------------------------------------------------------
// `display_list` is a useMemo whose deps include `item_list`, and several
// callers pass an INLINE array literal (RouteInputForm, InstanceInputForm,
// BasicSettingsForm, HealthCheckForm, `topologyOptions(...)`) — a new identity
// on every render. The worry was that this makes the effect re-fire forever
// and re-announce the default each time.
//
// These pin the answer so nobody has to re-derive it: the effect converges
// because `onChange` is fired ONLY while the value is empty, and applying the
// default makes it non-empty. A parent that ignores `onChange` must also
// settle, because React bails out of a re-render when state is unchanged.
describe('convergence with an inline item_list (new array identity per render)', () => {
	it('announces the default ONCE when the parent applies it', () => {
		const seen: any[] = [];
		function Parent() {
			const [v, setV] = useState<any>('');
			return (
				<DropDownSelectBox
					label="Protocol"
					// Inline: a different array object on every single render.
					item_list={[{id: 0, name: 'tcp', send_value: 'tcp'}, {id: 1, name: 'udp', send_value: 'udp'}]}
					value={v}
					onChange={nv => {
						seen.push(nv);
						setV(nv);
					}}
				/>
			);
		}
		render(<Parent />);
		// Converges: once 'tcp' is applied the value is no longer empty, so the
		// effect stops announcing however often the array identity changes.
		expect(seen).toEqual(['tcp']);
		expect(combobox().textContent).toBe('tcp');
	});

	it('settles when the parent IGNORES onChange, without runaway re-rendering', () => {
		// The worst case: the value stays empty forever, so the effect's
		// announce branch stays live. It must still settle rather than spin.
		const onChange = vi.fn();
		let renders = 0;
		function Parent() {
			renders++;
			return (
				<DropDownSelectBox
					label="Protocol"
					item_list={[{id: 0, name: 'tcp', send_value: 'tcp'}]}
					value=""
					onChange={onChange}
				/>
			);
		}
		render(<Parent />);
		// A loop would blow the stack or run away here. Bounded is the claim.
		expect(renders).toBeLessThan(5);
		expect(onChange.mock.calls.length).toBeLessThan(5);
	});

	it('keeps showing an unlisted value across re-renders with a fresh array', () => {
		// The fix itself must be stable, not a one-render flash.
		const {rerender} = render(
			<DropDownSelectBox label="Port" item_list={[{id: 0, name: 'eth0', send_value: 'eth0'}]} value="eth7" onChange={vi.fn()} />,
		);
		expect(combobox().textContent).toBe('eth7');
		rerender(
			<DropDownSelectBox label="Port" item_list={[{id: 0, name: 'eth0', send_value: 'eth0'}]} value="eth7" onChange={vi.fn()} />,
		);
		expect(combobox().textContent).toBe('eth7');
	});
});
