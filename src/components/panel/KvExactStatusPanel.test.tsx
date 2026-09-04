//---------------------------------------------------------
// KV Exact Enforcement Status panel — display policy (AC-07..AC-11).
//---------------------------------------------------------
import 'locales/i18n';
import i18n from 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {ApiError} from 'connector/fetcher/fetcher_base';
import {IKvExactStatusEntry} from 'types/ai_gateway';
import {IServiceArguments} from 'types/load_balancer';
import KvExactStatusPanel from './KvExactStatusPanel';

const statusQuery = vi.hoisted(() => ({current: {} as any}));
const hookCalls = vi.hoisted(() => ({args: [] as any[]}));

vi.mock('hooks/instanceHook', () => ({
	useInstanceFromURL: () => ({id: 3, name: 'gw'}),
}));

vi.mock('hooks/query/kvExactStatusHook', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/kvExactStatusHook')>();
	return {
		...mod,
		useKvExactStatus: (...args: unknown[]) => {
			hookCalls.args.push(args);
			return statusQuery.current;
		},
	};
});

function entry(over: Partial<IKvExactStatusEntry>): IKvExactStatusEntry {
	return {
		ruleIdentity: 'rule-1',
		modelName: 'Qwen/Qwen3-32B',
		engineFamily: 'vllm',
		apiMode: 'chat',
		modelProfileId: 'qwen3-chat',
		modelProfileGen: 4,
		bindingGen: 2,
		bindingDigest: 'sha256:bind123',
		hashContractId: 'sha256_cbor',
		requiredEvidenceLevel: 'attested',
		desiredState: 'READY',
		enforcedState: 'PENDING_DATAPLANE_CONTRACT',
		reasonCodes: [],
		...over,
	};
}

function args(over: Partial<IServiceArguments> = {}): IServiceArguments {
	return {
		name: 'r', externalIP: '192.0.2.1', inactiveTimeOut: 30, port: 8000, protocol: 'tcp',
		mode: 4, kvExactMode: 1, pd_disagg_mode: true, kvModelProfile: 'qwen3-chat', kvExactApiMode: 'chat',
		...over,
	} as IServiceArguments;
}

function setQuery(over: Partial<{data: unknown; error: unknown; isPending: boolean}>) {
	statusQuery.current = {data: undefined, error: null, isPending: false, isFetching: false, refetch: vi.fn(), ...over};
}

function renderPanel(sa: IServiceArguments = args()) {
	return render(<KvExactStatusPanel serviceArguments={sa} />);
}

beforeEach(async () => {
	hookCalls.args.length = 0;
	await i18n.changeLanguage('en');
});
afterEach(cleanup);

describe('readiness display (AC-07/08)', () => {
	it('never shows Ready for a pending ladder state — a saved rule is not a ready rule', () => {
		setQuery({data: [entry({enforcedState: 'PENDING_DATAPLANE_CONTRACT'})]});
		renderPanel();
		expect(screen.getByText(/Not ready — PENDING_DATAPLANE_CONTRACT/)).toBeTruthy();
		expect(screen.queryByText(/Ready — fully attested/)).toBeNull();
	});

	it('shows Ready only for READY with an explicitly lifted fence', () => {
		setQuery({data: [entry({enforcedState: 'READY', enforcement: {desired: 'READY', enforced: 'READY', goFenced: false, lastAckAt: '2026-09-04T10:00:00Z'}})]});
		renderPanel();
		expect(screen.getByText(/Ready — fully attested and enforced/)).toBeTruthy();
	});

	it('distinguishes a closed fence from an unreported fence on READY', () => {
		setQuery({data: [entry({enforcedState: 'READY', enforcement: {desired: 'READY', enforced: 'READY', goFenced: true}})]});
		renderPanel();
		expect(screen.getByText(/fence is closed — exact routing is denied/)).toBeTruthy();
		cleanup();

		setQuery({data: [entry({enforcedState: 'READY'})]});
		renderPanel();
		expect(screen.getByText(/fence state is not reported — not treated as ready/)).toBeTruthy();
	});

	it('marks READY_FUNCTIONAL_ONLY as a distinct warning, never plain Ready (AC-08 vs FR-04)', () => {
		setQuery({data: [entry({enforcedState: 'READY_FUNCTIONAL_ONLY', enforcement: {desired: 'READY', enforced: 'READY_FUNCTIONAL_ONLY', goFenced: false}})]});
		renderPanel();
		expect(screen.getByText(/Ready \(functional only\) — audited opt-in without a manifest trust root/)).toBeTruthy();
		expect(screen.queryByText(/Ready — fully attested and enforced/)).toBeNull();
	});
});

describe('unsafe states (AC-09)', () => {
	it('renders degraded and fault with explicit unsafe text and raw reason chips', () => {
		setQuery({data: [entry({enforcedState: 'DEGRADED', reasonCodes: ['challenge_failed', 'attestation_stale']})]});
		renderPanel();
		expect(screen.getByText(/Degraded — fenced after a confirmed degradation/)).toBeTruthy();
		expect(screen.getByText('challenge_failed')).toBeTruthy();
		expect(screen.getByText('attestation_stale')).toBeTruthy();
		cleanup();

		setQuery({data: [entry({enforcedState: 'ENFORCEMENT_FAULT', enforcement: {desired: 'READY', enforced: 'ENFORCEMENT_FAULT', goFenced: true, fault: 'contract word rejected'}})]});
		renderPanel();
		expect(screen.getByText(/Enforcement fault — fenced, not silently downgraded/)).toBeTruthy();
		expect(screen.getByText(/Fenced — exact routing denied/)).toBeTruthy();
	});
});

describe('unknown vocabulary (AC-10)', () => {
	it('renders an unknown state raw, as not ready, without crashing', () => {
		setQuery({data: [entry({enforcedState: 'QUANTUM_ATTESTED_V9', reasonCodes: ['brand_new_reason_code']})]});
		renderPanel();
		expect(screen.getByText(/Unknown state "QUANTUM_ATTESTED_V9" — treated as not ready/)).toBeTruthy();
		expect(screen.getByText('brand_new_reason_code')).toBeTruthy();
	});
});

describe('legacy rules (AC-11)', () => {
	it('shows Legacy / unattested and hides the strict-only sections', () => {
		setQuery({data: [entry({enforcedState: 'LEGACY_ACTIVE_UNATTESTED', modelProfileId: undefined, bindingDigest: undefined, enforcement: undefined, reasonCodes: ['no_model_profile_bound']})]});
		renderPanel(args({kvModelProfile: undefined, kvExactApiMode: undefined}));
		expect(screen.getByText(/Legacy \/ unattested — profile-less rule/)).toBeTruthy();
		expect(screen.queryByText('Binding Identity')).toBeNull();
		expect(screen.queryByText('Data-plane Enforcement')).toBeNull();
	});

	it('asks the hook for a single read, not polling, on a legacy rule (FR-05)', () => {
		setQuery({data: [entry({enforcedState: 'LEGACY_ACTIVE_UNATTESTED'})]});
		renderPanel(args({kvModelProfile: undefined, kvExactApiMode: undefined}));
		// useKvExactStatus(instance, key, visible, strict) — strict must be false.
		expect(hookCalls.args.at(-1)?.[3]).toBe(false);
	});
});

describe('error vocabulary (FR-05 / MP-E2E-015)', () => {
	it('renders "no status" for the coalesced 404 (connector null) without an error surface', () => {
		setQuery({data: null});
		renderPanel();
		expect(screen.getByText('No KV-exact status for this selection.')).toBeTruthy();
		expect(screen.queryByRole('button', {name: 'Retry'})).toBeNull();
	});

	it('renders 422 as terminal — no retry affordance', () => {
		setQuery({error: new ApiError('bad key', 422)});
		renderPanel();
		expect(screen.getByText(/rejected the status query as malformed \(422\)/)).toBeTruthy();
		expect(screen.queryByRole('button', {name: 'Retry'})).toBeNull();
	});

	it('renders 503 as temporarily unavailable with a manual retry', () => {
		setQuery({error: new ApiError('unavailable', 503)});
		renderPanel();
		expect(screen.getByText(/temporarily unavailable/)).toBeTruthy();
		expect(screen.getByRole('button', {name: 'Retry'})).toBeTruthy();
	});

	it('renders 403 as a permission problem', () => {
		setQuery({error: new ApiError('forbidden', 403)});
		renderPanel();
		expect(screen.getByText(/don't have permission to read the KV-exact enforcement status/)).toBeTruthy();
	});
});

describe('gating', () => {
	it('renders nothing and never enables the query on a non-exact rule', () => {
		setQuery({data: undefined, isPending: true});
		const {container} = renderPanel(args({kvExactMode: 0, kvModelProfile: undefined, kvExactApiMode: undefined, pd_disagg_mode: false}));
		expect(container.textContent).toBe('');
		// instance/key are null → the hook cannot enable the query.
		expect(hookCalls.args.at(-1)?.[0]).toBeNull();
		expect(hookCalls.args.at(-1)?.[1]).toBeNull();
	});
});
