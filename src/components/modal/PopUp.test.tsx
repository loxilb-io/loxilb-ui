//---------------------------------------------------------
// UI-P2-2 — shared confirm/info dialog contract
// (npm test src/components/modal/PopUp.test.tsx)
//
// Red-first for the dialog rebuild: dismissal (Escape /
// backdrop) with a close reason, dialog naming for screen
// readers, truthful in-flight semantics (dialog stays up and
// locked while handle_yes runs), persistent flows, focus
// management, and the 90vh scroll-body layout guard.
//---------------------------------------------------------
import i18n from 'locales/i18n';
import PopUp from 'components/modal/PopUp';
import userEvent from '@testing-library/user-event';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import {RecoilRoot} from 'recoil';
import {usePopUp} from 'hooks/popupHook';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

//---------------------------------------------------------
// Harness
//---------------------------------------------------------
// The extra opts argument ({persistent, handle_no}) is part of the UI-P2-2
// contract; the cast keeps typecheck green while the tests run red against
// the pre-fix signature.
type OpenArgs = [string, any, string?, string?, (() => void | Promise<void>)?, boolean?, {persistent?: boolean; handle_no?: (reason: string) => void}?];

function Opener({args}: {args: OpenArgs}) {
	const {openPopUp} = usePopUp();
	return (
		<button type="button" onClick={() => (openPopUp as any)(...args)}>
			opener
		</button>
	);
}

function renderPopUp(args: OpenArgs) {
	return render(
		<RecoilRoot>
			<Opener args={args} />
			<PopUp />
		</RecoilRoot>,
	);
}

async function openDialog(user: ReturnType<typeof userEvent.setup>, args: OpenArgs) {
	renderPopUp(args);
	await user.click(screen.getByRole('button', {name: 'opener'}));
	return screen.getByRole('dialog');
}

function backdrop(): Element {
	const el = document.querySelector('.MuiBackdrop-root');
	expect(el, 'expected an open modal backdrop').not.toBeNull();
	return el!;
}

beforeEach(async () => {
	await i18n.changeLanguage('en');
});

afterEach(cleanup);

//---------------------------------------------------------
// Dismissal + close reason (ES-16/13)
//---------------------------------------------------------
describe('PopUp dismissal', () => {
	it('Escape closes a normal dialog and calls handle_no("escape") exactly once', async () => {
		const user = userEvent.setup();
		const handle_yes = vi.fn();
		const handle_no = vi.fn();
		await openDialog(user, ['Delete rule', 'Really delete?', 'Yes', 'Cancel', handle_yes, undefined, {handle_no}]);

		await user.keyboard('{Escape}');

		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(handle_no).toHaveBeenCalledTimes(1);
		expect(handle_no).toHaveBeenCalledWith('escape');
		expect(handle_yes).not.toHaveBeenCalled();
	});

	it('backdrop click closes and calls handle_no("backdrop") exactly once', async () => {
		const user = userEvent.setup();
		const handle_yes = vi.fn();
		const handle_no = vi.fn();
		await openDialog(user, ['Delete rule', 'Really delete?', 'Yes', 'Cancel', handle_yes, undefined, {handle_no}]);

		await user.click(backdrop());

		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(handle_no).toHaveBeenCalledTimes(1);
		expect(handle_no).toHaveBeenCalledWith('backdrop');
		expect(handle_yes).not.toHaveBeenCalled();
	});

	it('Cancel button closes with handle_no("no") and never fires handle_yes', async () => {
		const user = userEvent.setup();
		const handle_yes = vi.fn();
		const handle_no = vi.fn();
		await openDialog(user, ['Delete rule', 'Really delete?', 'Yes', 'Cancel', handle_yes, undefined, {handle_no}]);

		await user.click(screen.getByRole('button', {name: 'Cancel'}));

		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(handle_no).toHaveBeenCalledTimes(1);
		expect(handle_no).toHaveBeenCalledWith('no');
		expect(handle_yes).not.toHaveBeenCalled();
	});
});

//---------------------------------------------------------
// Naming for assistive tech (ES-10)
//---------------------------------------------------------
describe('PopUp dialog semantics', () => {
	it('has aria-labelledby and aria-describedby resolving to the rendered title/body', async () => {
		const user = userEvent.setup();
		const dialog = await openDialog(user, ['Confirm restart', 'The instance will restart now.', 'OK']);

		const labelId = dialog.getAttribute('aria-labelledby');
		const descId = dialog.getAttribute('aria-describedby');
		expect(labelId).toBeTruthy();
		expect(descId).toBeTruthy();
		expect(document.getElementById(labelId!)?.textContent).toContain('Confirm restart');
		expect(document.getElementById(descId!)?.textContent).toContain('The instance will restart now.');
	});
});

//---------------------------------------------------------
// Truthful in-flight semantics (ES-15/24)
//---------------------------------------------------------
describe('PopUp busy state', () => {
	it('keeps the dialog up and locked while handle_yes is pending, closes after it resolves', async () => {
		const user = userEvent.setup();
		let resolveAction!: () => void;
		const handle_yes = vi.fn(() => new Promise<void>(resolve => (resolveAction = resolve)));
		await openDialog(user, ['Apply config', 'Apply?', 'Yes', 'Cancel', handle_yes]);

		await user.click(screen.getByRole('button', {name: 'Yes'}));

		// Still open while the action runs; both buttons disabled; Escape inert.
		expect(screen.getByRole('dialog')).toBeTruthy();
		expect(handle_yes).toHaveBeenCalledTimes(1);
		await waitFor(() => {
			for (const b of screen.getAllByRole('button')) {
				if (b.textContent === 'opener') continue;
				expect(b, `button "${b.textContent}" must be disabled while busy`).toHaveProperty('disabled', true);
			}
		});
		await user.keyboard('{Escape}');
		expect(screen.getByRole('dialog')).toBeTruthy();

		resolveAction();
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	});

	it('a rejecting handle_yes still closes the dialog and clears busy (no stuck modal)', async () => {
		const user = userEvent.setup();
		const handle_yes = vi.fn(() => Promise.reject(new Error('backend 500')));
		await openDialog(user, ['Apply config', 'Apply?', 'Yes', 'Cancel', handle_yes]);

		await user.click(screen.getByRole('button', {name: 'Yes'}));
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

		// Reopen: dialog must be usable again (busy cleared).
		await user.click(screen.getByRole('button', {name: 'opener'}));
		const yes = await screen.findByRole('button', {name: 'Yes'});
		expect(yes).toHaveProperty('disabled', false);
	});

	it('a handle_yes that opens a follow-up popup leaves the follow-up standing', async () => {
		// The API-key reveal and Success confirmations are opened from INSIDE
		// handle_yes through the same singleton atom; the post-settle close
		// must not tear down the popup that replaced it (the one-time raw key
		// would flash and vanish).
		function ChainedOpener() {
			const {openPopUp} = usePopUp();
			return (
				<button
					type="button"
					onClick={() =>
						openPopUp('Create key', 'create?', 'Add', 'Cancel', async () => {
							await Promise.resolve();
							openPopUp('API Key Created', 'raw-key-shown-once', 'OK');
						})
					}>
					opener
				</button>
			);
		}
		const user = userEvent.setup();
		render(
			<RecoilRoot>
				<ChainedOpener />
				<PopUp />
			</RecoilRoot>,
		);
		await user.click(screen.getByRole('button', {name: 'opener'}));
		await user.click(screen.getByRole('button', {name: 'Add'}));

		await screen.findByText('raw-key-shown-once');
		// Let the settle-close land, then re-assert: the follow-up must survive.
		await new Promise(r => setTimeout(r, 50));
		expect(screen.getByRole('dialog')).toBeTruthy();
		expect(screen.getByText('raw-key-shown-once')).toBeTruthy();
	});

	it('double-clicking Yes fires the action exactly once', async () => {
		const user = userEvent.setup();
		let resolveAction!: () => void;
		const handle_yes = vi.fn(() => new Promise<void>(resolve => (resolveAction = resolve)));
		await openDialog(user, ['Apply config', 'Apply?', 'Yes', 'Cancel', handle_yes]);

		await user.dblClick(screen.getByRole('button', {name: 'Yes'}));
		expect(handle_yes).toHaveBeenCalledTimes(1);

		resolveAction();
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	});
});

//---------------------------------------------------------
// Persistent flows (API-key reveal, forced relogin)
//---------------------------------------------------------
describe('PopUp persistent mode', () => {
	it('ignores repeated Escape and backdrop clicks; only the buttons dismiss', async () => {
		const user = userEvent.setup();
		const handle_yes = vi.fn();
		const handle_no = vi.fn();
		await openDialog(user, ['API Key Created', 'copy-me-now', 'OK', undefined, handle_yes, undefined, {persistent: true, handle_no}]);

		for (let i = 0; i < 10; i++) {
			await user.keyboard('{Escape}');
		}
		await user.click(backdrop());

		expect(screen.getByRole('dialog')).toBeTruthy();
		expect(handle_no).not.toHaveBeenCalled();

		await user.click(screen.getByRole('button', {name: 'OK'}));
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		expect(handle_yes).toHaveBeenCalledTimes(1);
	});
});

//---------------------------------------------------------
// Focus contract
//---------------------------------------------------------
describe('PopUp focus management', () => {
	it('initial focus lands on Cancel when both buttons exist', async () => {
		const user = userEvent.setup();
		await openDialog(user, ['Delete rule', 'Really delete?', 'Yes', 'Cancel', vi.fn()]);
		await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Cancel'})));
	});

	it('initial focus lands on the sole OK button of an info dialog', async () => {
		const user = userEvent.setup();
		await openDialog(user, ['Success', 'Saved.', 'OK']);
		await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', {name: 'OK'})));
	});

	it('focus returns to the opener after Escape-close', async () => {
		const user = userEvent.setup();
		await openDialog(user, ['Delete rule', 'Really delete?', 'Yes', 'Cancel', vi.fn()]);
		await user.keyboard('{Escape}');
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', {name: 'opener'})));
	});
});

//---------------------------------------------------------
// i18n chrome (ES-18)
//---------------------------------------------------------
describe('PopUp default labels', () => {
	it('default Yes label goes through i18n (ko shows 예, not the literal "Yes")', async () => {
		await i18n.changeLanguage('ko');
		const user = userEvent.setup();
		renderPopUp(['제목', '내용']);
		await user.click(screen.getByRole('button', {name: 'opener'}));

		expect(screen.queryByRole('button', {name: 'Yes'})).toBeNull();
		expect(screen.getByRole('button', {name: '예'})).toBeTruthy();
	});
});

//---------------------------------------------------------
// 90vh scroll-body layout guard (fixed real below-the-fold
// bugs — IPsec/LB dialogs at 1512×741; must survive the
// Modal→Dialog rebuild)
//---------------------------------------------------------
describe('PopUp scroll-body layout', () => {
	it('keeps the 90vh flex column with an internally scrolling body', async () => {
		const user = userEvent.setup();
		const dialog = await openDialog(user, ['Tall form', <div style={{height: 5000}}>tall</div>, 'Yes', 'Cancel', vi.fn()]);

		// The styled surface is the dialog element itself or a wrapper inside it.
		const surfaces = [dialog, ...Array.from(dialog.querySelectorAll('*'))] as HTMLElement[];
		const column = surfaces.find(el => {
			const cs = getComputedStyle(el);
			return cs.maxHeight === '90vh' && cs.display === 'flex' && cs.flexDirection === 'column';
		});
		expect(column, 'a 90vh flex-column dialog surface must exist').toBeTruthy();

		const body = surfaces.find(el => {
			const cs = getComputedStyle(el);
			return cs.overflowY === 'auto' && cs.minHeight === '0px';
		});
		expect(body, 'an internally scrolling body (overflow-y auto, min-height 0) must exist').toBeTruthy();
	});
});
