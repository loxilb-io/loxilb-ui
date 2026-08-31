//---------------------------------------------------------
// UI-P6-2 — numeric input raw-string state (no silent coercion)
// (npm test src/components/input/NumericInputs.test.tsx)
//
// Red-first against the parseInt(...)||0 sites (C-3 inventory, 17/5) AND the
// TextBox number-mode coercion layer beneath them: empty → onChange(0),
// negative/over-max silently clamped, NaN swallowed (parent keeps a STALE
// value while the display shows garbage), and type="number" hides invalid
// text from JS entirely (badInput → value ''). Contract under test:
// raw text is the state; garbage is never coerced to 0 ("0" means
// UNLIMITED on the ApiKey rate fields), never clamped, never reverted;
// submit gates on validity; the zero-sentinel serialization (key omitted
// when 0) stays byte-identical for valid inputs.
//---------------------------------------------------------
import ApiKeyInputForm from 'components/input/ApiKeyInputForm';
import SecurityRateInputForm from 'components/input/SecurityRateInputForm';
import BGPGlobalPage from 'pages/network/BGPGlobalPage';
import PopUp from 'components/modal/PopUp';
import {RecoilRoot} from 'recoil';
import userEvent from '@testing-library/user-event';
import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {request_configure_bgp_global} from 'connector/instance/bgp';
import {t} from 'i18next';
import 'locales/i18n';

// BGPGlobalPage harness: metadata + instance are mocked so the page renders
// standalone; the connector mock captures the exact wire payload on Apply.
vi.mock('hooks/instanceHook', () => ({useInstanceFromURL: () => ({id: 1, name: 'gw'})}));
vi.mock('hooks/query/queryHooks', () => {
	const BGP_PARAMS = {
		routerId: {type: 'string', description: 'BGP Router ID', required: true},
		localAs: {type: 'integer', description: 'Local AS number', required: true},
		SetNextHopSelf: {type: 'boolean', description: 'next hop self'},
		listenPort: {type: 'integer', description: 'Listen port (default 179)'},
	};
	return {useMetadata: () => ({is_fetched: true, param_fields: BGP_PARAMS, get_param: () => BGP_PARAMS})};
});
vi.mock('connector/instance/bgp', () => ({
	request_configure_bgp_global: vi.fn().mockResolvedValue({status: 'confirmed', code: 'ok', localeKey: 'ok', retryable: false}),
}));

afterEach(() => cleanup());

const lastCall = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1][0];

//---------------------------------------------------------
// ApiKeyInputForm — rate_limit_rps / burst_size / tokens_per_min
// (all optional int64, 0 = unlimited/default BY OMISSION)
//---------------------------------------------------------
describe('UI-P6-2 ApiKey numeric fields', () => {
	async function renderFormWithTenant(user: ReturnType<typeof userEvent.setup>) {
		const onChange = vi.fn();
		render(<ApiKeyInputForm onChange={onChange} />);
		// Tenant satisfied so isValid isolates the numeric fields under test.
		await user.type(screen.getByLabelText(/Tenant ID/), 'e2e-tn');
		expect(lastCall(onChange).isValid).toBe(true);
		return onChange;
	}

	it('garbage in Rate Limit blocks submit and stays visible for correction', async () => {
		const user = userEvent.setup();
		const onChange = await renderFormWithTenant(user);
		const field = screen.getByLabelText(/Rate Limit/);
		await user.clear(field);
		await user.type(field, 'abc');
		await user.tab();
		// RED today (two stacked defects): type="number" swallows the letters at
		// the DOM (badInput → value ''), TextBox maps '' → onChange(0) → the form
		// treats a typo as 0 = UNLIMITED and stays submittable with zero feedback.
		expect(lastCall(onChange).isValid).toBe(false);
		expect((field as HTMLInputElement).value).toBe('abc');
	});

	it('partial parse "12a" is rejected, not truncated to 12', async () => {
		const user = userEvent.setup();
		const onChange = await renderFormWithTenant(user);
		const field = screen.getByLabelText(/Rate Limit/);
		await user.clear(field);
		await user.type(field, '12a');
		await user.tab();
		// RED today: becomes 12 and the form reports valid.
		expect(lastCall(onChange).isValid).toBe(false);
		expect((field as HTMLInputElement).value).toBe('12a');
	});

	it('a cleared optional field survives blur visibly empty (no snap to 0)', async () => {
		const user = userEvent.setup();
		await renderFormWithTenant(user);
		const field = screen.getByLabelText(/Burst Size/);
		await user.clear(field);
		await user.tab();
		// RED today: TextBox syncs the parent's coerced 0 back on blur — the
		// user can never see an empty field at rest.
		expect((field as HTMLInputElement).value).toBe('');
	});

	it('negative input is an error, not silently clamped to 0', async () => {
		const user = userEvent.setup();
		const onChange = await renderFormWithTenant(user);
		const field = screen.getByLabelText(/Tokens \/ Minute/);
		await user.clear(field);
		await user.type(field, '-5');
		await user.tab();
		// RED today: TextBox clamps parsed < 0 to 0 (= unlimited) without feedback.
		expect(lastCall(onChange).isValid).toBe(false);
		expect((field as HTMLInputElement).value).toBe('-5');
	});

	it('correction flow: garbage → invalid → fixed → valid again', async () => {
		const user = userEvent.setup();
		const onChange = await renderFormWithTenant(user);
		const field = screen.getByLabelText(/Tokens \/ Minute/);
		await user.clear(field);
		await user.type(field, 'x');
		await user.tab();
		expect(lastCall(onChange).isValid).toBe(false);
		await user.clear(field);
		await user.type(field, '600');
		await user.tab();
		expect(lastCall(onChange).isValid).toBe(true);
		expect(lastCall(onChange).tokens_per_min).toBe(600);
	});

	// Zero-sentinel serialization parity — must hold BEFORE and AFTER the fix
	// (parent rule 7: 0 ⇒ key omitted, byte-identical wire shape).
	it('typed 0 keeps the sentinel-by-omission wire shape', async () => {
		const user = userEvent.setup();
		const onChange = await renderFormWithTenant(user);
		const field = screen.getByLabelText(/Rate Limit/);
		await user.clear(field);
		await user.type(field, '0');
		await user.tab();
		const payload = lastCall(onChange);
		expect(payload.isValid).toBe(true);
		expect('rate_limit_rps' in payload).toBe(false);
		expect('burst_size' in payload).toBe(false);
		expect('tokens_per_min' in payload).toBe(false);
	});

	it('valid inputs serialize exactly as before (payload parity)', async () => {
		const user = userEvent.setup();
		const onChange = await renderFormWithTenant(user);
		await user.clear(screen.getByLabelText(/Rate Limit/));
		await user.type(screen.getByLabelText(/Rate Limit/), '5');
		await user.clear(screen.getByLabelText(/Burst Size/));
		await user.type(screen.getByLabelText(/Burst Size/), '10');
		await user.clear(screen.getByLabelText(/Tokens \/ Minute/));
		await user.type(screen.getByLabelText(/Tokens \/ Minute/), '600');
		await user.tab();
		const {isValid, ...payload} = lastCall(onChange);
		expect(isValid).toBe(true);
		expect(payload).toEqual({tenant_id: 'e2e-tn', rate_limit_rps: 5, burst_size: 10, tokens_per_min: 600, enabled: true});
	});
});

//---------------------------------------------------------
// SecurityRateInputForm — 5 required int64 fields with gateway
// bounds; garbage→0 today trips the *zero-threshold* warning
// (misleading) and destroys the typed text.
//---------------------------------------------------------
describe('UI-P6-2 SecurityRate numeric fields', () => {
	function renderForm() {
		const onChange = vi.fn();
		render(<SecurityRateInputForm onChange={onChange} />);
		return onChange;
	}

	it('garbage in SYN Threshold preserves the typed text and reports invalid', async () => {
		const user = userEvent.setup();
		const onChange = renderForm();
		const field = screen.getByLabelText(/SYN Threshold/);
		await user.clear(field);
		await user.type(field, 'abc');
		await user.tab();
		// RED today: the DOM swallows the letters, the field snaps back to '0' on
		// blur, and the form shows the misleading zero-threshold warning instead
		// of an integer-format error on the field itself.
		expect(lastCall(onChange).isValid).toBe(false);
		expect((field as HTMLInputElement).value).toBe('abc');
	});

	it('partial parse "50x" is not accepted as 50', async () => {
		const user = userEvent.setup();
		const onChange = renderForm();
		const field = screen.getByLabelText(/Cookie Threshold/);
		await user.clear(field);
		await user.type(field, '50x');
		await user.tab();
		// RED today: becomes 50 (< default synThreshold 100) → reported valid.
		expect(lastCall(onChange).isValid).toBe(false);
		expect((field as HTMLInputElement).value).toBe('50x');
	});

	it('over-max input is an error, not silently clamped', async () => {
		const user = userEvent.setup();
		const onChange = renderForm();
		// Enable the UDP section to render its fields.
		await user.click(screen.getByLabelText(/Enable UDP Flood Protection/));
		const udpField = screen.getByLabelText(/UDP Bandwidth/);
		await user.clear(udpField);
		await user.type(udpField, '99999'); // gateway cap 4095
		await user.tab();
		// The raw text must survive with a range error — never a silent clamp.
		expect(lastCall(onChange).isValid).toBe(false);
		expect((udpField as HTMLInputElement).value).toBe('99999');
	});

	it('valid edit round-trips unchanged (parity)', async () => {
		const user = userEvent.setup();
		const onChange = renderForm();
		const field = screen.getByLabelText(/SYN Threshold/);
		await user.clear(field);
		await user.type(field, '200');
		await user.tab();
		const payload = lastCall(onChange);
		expect(payload.synThreshold).toBe(200);
		expect(payload.isValid).toBe(true);
	});

	it('cross-field rule still enforced: cookieThreshold >= synThreshold invalid', async () => {
		const user = userEvent.setup();
		const onChange = renderForm();
		const field = screen.getByLabelText(/Cookie Threshold/);
		await user.clear(field);
		await user.type(field, '100'); // == default synThreshold
		await user.tab();
		expect(lastCall(onChange).isValid).toBe(false);
	});
});

//---------------------------------------------------------
// BGPGlobalPage — localAs (required, AS number) + listenPort (optional port)
//---------------------------------------------------------
describe('UI-P6-2 BGP numeric fields', () => {
	function renderPage() {
		return render(
			<RecoilRoot>
				<BGPGlobalPage />
				<PopUp />
			</RecoilRoot>,
		);
	}

	it('garbage in Local AS shows the typed text + a field error, not the bogus required popup', async () => {
		const user = userEvent.setup();
		renderPage();
		const field = screen.getByLabelText('Local AS *', {selector: 'input'});
		await user.clear(field);
		await user.type(field, 'abc');
		await user.tab();
		// RED today: the DOM swallows the letters, parseInt('')||0 stores 0, and
		// Apply pops 'Router ID and Local AS are required.' — a lie: the field
		// isn't missing, it's invalid, and the typed text has vanished.
		expect((field as HTMLInputElement).value).toBe('abc');
		await user.click(screen.getByRole('button', {name: 'Apply'}));
		expect(screen.queryByText('Router ID and Local AS are required.')).toBeNull();
		expect(screen.getByText('Must be a whole number.')).toBeTruthy();
	});

	it('cleared Listen Port is omitted from the payload, never sent as 0', async () => {
		const user = userEvent.setup();
		renderPage();
		await user.type(screen.getByLabelText('Router ID *', {selector: 'input'}), '10.0.0.1');
		const asField = screen.getByLabelText('Local AS *', {selector: 'input'});
		await user.clear(asField);
		await user.type(asField, '65001');
		const portField = screen.getByLabelText('Listen Port', {selector: 'input'});
		await user.clear(portField);
		await user.tab();
		await user.click(screen.getByRole('button', {name: 'Apply'}));
		// Confirm dialog → Apply (Yes).
		const dialog = await screen.findByRole('dialog');
		await user.click(within(dialog).getByRole('button', {name: t('Apply')}));
		await waitFor(() => expect(request_configure_bgp_global).toHaveBeenCalled());
		const payload = vi.mocked(request_configure_bgp_global).mock.calls[0][1] as Record<string, unknown>;
		expect(payload.localAs).toBe(65001);
		expect(payload.routerId).toBe('10.0.0.1');
		// RED today: parseInt(undefined)||0 turns the cleared optional port into
		// listenPort: 0 on the wire (an invalid port; schema default is 179).
		expect('listenPort' in payload).toBe(false);
	});
});
