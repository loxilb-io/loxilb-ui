//---------------------------------------------------------
// Token-quota panel — what an operator is TOLD (Stage 3.6)
//---------------------------------------------------------
// The derivation is pinned in observability/tokenQuota.test.ts. This file
// pins the half derivation cannot: the words.
//
// ⭐⭐ The property that matters most here is that two OPPOSITE situations
// produce the same empty metric, and the panel must not read alike in them. A
// gateway with no quota store and a gateway whose quota store has fallen over
// both export nothing; the second is silently admitting traffic that should
// be throttled. The tests below pin that the second says so in alarm
// vocabulary and the first does not.
import 'locales/i18n';
import i18n from 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {IQuotaReport, IQuotaRow, QuotaScope, ScopeAbsence} from 'observability/tokenQuota';
import TokenQuotaPanel from './TokenQuotaPanel';

const SCOPES: readonly QuotaScope[] = ['tenant', 'tenant-model', 'user', 'user-model', 'key', 'vip'];

function scopesWith(rows: readonly IQuotaRow[]) {
	return SCOPES.map(scope => ({
		scope,
		absent: rows.every(r => r.scope !== scope),
		rows: rows.filter(r => r.scope === scope),
		anomalies: [],
	}));
}

const report = (over: Partial<IQuotaReport> = {}): IQuotaReport => {
	const rows = over.rows ?? [];
	return {
		verdict: 'not-configurable',
		storeState: 'unconfigured',
		scopes: scopesWith(rows),
		rows,
		anomalies: [],
		coldOpened: false,
		userIdentityUnavailable: false,
		...over,
	};
};

const row = (over: Partial<IQuotaRow> = {}): IQuotaRow => ({
	scope: 'tenant',
	labels: {tenant: 'acme'},
	utilization: 0.25,
	limitTokens: 1000,
	headroomTokens: 750,
	pressure: 'within',
	...over,
});

function renderPanel(r: IQuotaReport, absenceByScope: Partial<Record<QuotaScope, ScopeAbsence>> = {}) {
	return render(<TokenQuotaPanel report={r} limitResolvesByScope={{}} absenceByScope={absenceByScope} />);
}

// Vocabulary that tells an operator something is WRONG and that they must go
// act on it.
//
// ⚠️ "not being enforced" is deliberately NOT a substring test against the
// neutral copy: the benign "no quota store" sentence legitimately says limits
// "can be neither configured nor enforced". This is the same trap 3.2 and 3.4
// both hit — a neutral explanation has to describe the mechanism, and the
// mechanism shares the alarm's words. So the alarm is identified by its own
// distinctive clause instead.
const ALARM = /being admitted|currently unenforced/i;

beforeEach(async () => {
	await i18n.changeLanguage('en');
});
afterEach(cleanup);

describe('the store-state verdict', () => {
	// ⚠️⚠️ THE FINDING. Same empty exposition, opposite meaning.
	it('raises an alarm when the store is configured and unreachable', () => {
		renderPanel(report({verdict: 'enforcement-offline', storeState: 'unavailable'}));
		expect(screen.getByText('Token quotas are not being enforced')).toBeTruthy();
		expect(screen.getByText(ALARM)).toBeTruthy();
	});

	it('says plainly that the alarm state is indistinguishable from the benign one on the metrics alone', () => {
		renderPanel(report({verdict: 'enforcement-offline', storeState: 'unavailable'}));
		expect(screen.getByText(/look identical to a gateway with no quotas configured/i)).toBeTruthy();
	});

	// ⭐ The live-verified path on the testbed.
	it('does NOT raise an alarm when no quota store is configured', () => {
		renderPanel(report({verdict: 'not-configurable', storeState: 'unconfigured'}));
		expect(screen.getByText('No quota store is configured')).toBeTruthy();
		expect(screen.queryByText(ALARM)).toBeNull();
	});

	it('does not raise an alarm on a configured-but-idle gateway', () => {
		renderPanel(report({verdict: 'idle', storeState: 'readable'}));
		expect(screen.getByText('Limits configured, nothing metered yet')).toBeTruthy();
		expect(screen.queryByText(ALARM)).toBeNull();
	});

	// ⚠️ 3.4's fourth state. Must not be phrased as either answer.
	it('says an unknown store state means nothing either way', () => {
		renderPanel(report({verdict: 'indeterminate', storeState: 'unknown'}));
		expect(screen.getByText('Whether quotas are enforced cannot be determined')).toBeTruthy();
		expect(screen.getByText(/equally consistent with/i)).toBeTruthy();
	});

	it('reports the live bucket count when quotas are being enforced', () => {
		renderPanel(report({verdict: 'active', storeState: 'readable', rows: [row()]}));
		expect(screen.getByText(/Live quota buckets, charged at scrape time: 1\./)).toBeTruthy();
	});
});

describe('utilization rendering', () => {
	// ⚠️⚠️ The clamp trap, pinned at the surface. The bar cannot draw past
	// full, but the NUMBER must, and it is the number that carries the reading.
	it('prints a debt reading above 100% rather than clamping it', () => {
		renderPanel(report({
			verdict: 'active', storeState: 'readable',
			rows: [row({scope: 'key', labels: {key_id: 'df53abcb'}, utilization: 1.1, limitTokens: 10, headroomTokens: -1, pressure: 'in-debt'})],
		}));
		expect(screen.getByText('110.0%')).toBeTruthy();
	});

	// ⚠️ Negative headroom stays negative: it is how far past the bound the
	// settle went.
	it('shows headroom as negative while the bucket is in debt', () => {
		renderPanel(report({
			verdict: 'active', storeState: 'readable',
			rows: [row({utilization: 1.1, limitTokens: 10, headroomTokens: -1, pressure: 'in-debt'})],
		}));
		expect(screen.getByText('-1')).toBeTruthy();
	});

	// ⚠️ "In debt" is explained, not alarmed — it is the limiter working.
	it('labels debt without alarm vocabulary', () => {
		renderPanel(report({
			verdict: 'active', storeState: 'readable',
			rows: [row({utilization: 1.4, pressure: 'in-debt'})],
		}));
		expect(screen.getByText('In debt')).toBeTruthy();
		expect(screen.queryByText(ALARM)).toBeNull();
	});

	it('labels an exactly-full bucket as at its limit', () => {
		renderPanel(report({
			verdict: 'active', storeState: 'readable',
			rows: [row({utilization: 1, headroomTokens: 0, pressure: 'saturated'})],
		}));
		expect(screen.getByText('At limit')).toBeTruthy();
	});

	it('adds no chip to a bucket with headroom', () => {
		renderPanel(report({verdict: 'active', storeState: 'readable', rows: [row()]}));
		expect(screen.queryByText('At limit')).toBeNull();
		expect(screen.queryByText('In debt')).toBeNull();
	});
});

describe('per-scope absence', () => {
	// ⚠️⚠️ The sentence that must NOT tell an operator to configure something.
	it('says a user scope cannot appear at all when no user identity resolves', () => {
		renderPanel(report({userIdentityUnavailable: true}), {user: 'no-user-identity'});
		expect(screen.getByText(/configuring a user limit here would change nothing/i)).toBeTruthy();
	});

	it('distinguishes awaiting-charge from no-limit', () => {
		renderPanel(report(), {key: 'awaiting-charge', tenant: 'no-limit'});
		expect(screen.getByText(/created by the first charge/i)).toBeTruthy();
		expect(screen.getByText(/No limit resolves for this scope/i)).toBeTruthy();
	});

	// ⭐ The honest limit of the panel: the gateway's collection endpoints are
	// POST-only, so a scope the caller could not check must not be reported as
	// having no limit.
	it('says a scope it could not check was not checked, rather than calling it unset', () => {
		renderPanel(report(), {});
		expect(screen.getAllByText(/offers no way to list the identities/i).length).toBe(6);
	});
});

describe('caveats that survive a healthy verdict', () => {
	// ⚠️ Independent of the verdict: metering can be active AND have started cold.
	it('reports a cold open alongside an active verdict', () => {
		renderPanel(report({verdict: 'active', storeState: 'readable', rows: [row()], coldOpened: true}));
		expect(screen.getByText(/started serving quota traffic on empty state/i)).toBeTruthy();
		expect(screen.getByText(/Live quota buckets, charged at scrape time: 1\./)).toBeTruthy();
	});

	// ⭐ Impossible from the collector, so reported as a scrape defect rather
	// than rendered as a state.
	it('calls an unpaired series a defect in the scrape, not a gateway state', () => {
		renderPanel(report({
			verdict: 'active', storeState: 'readable', rows: [row()],
			anomalies: [{scope: 'tenant', labels: {tenant: 'a'}, kind: 'unpaired-series'}],
		}));
		expect(screen.getByText(/defect in the scrape rather than a state of the gateway/i)).toBeTruthy();
	});
});

describe('scope vocabulary', () => {
	// ⚠️⚠️ The manifest and the gauge HELP both call the VIP bucket
	// "keyless", and `quotaBucketsFor` charges it for every request on the
	// service. Copying the manifest's word would tell an operator their
	// credentialed traffic does not fill this bucket.
	it('does not describe the shared service bucket as keyless-only', () => {
		renderPanel(report(), {vip: 'no-limit'});
		expect(screen.getByText(/credentialed and keyless alike/i)).toBeTruthy();
	});

	it('names the key scope by its opaque identifier and never promises key material', () => {
		renderPanel(report({
			verdict: 'active', storeState: 'readable',
			rows: [row({scope: 'key', labels: {key_id: 'df53abcb'}})],
		}));
		expect(screen.getByText(/never the key material/i)).toBeTruthy();
		expect(screen.getByText('df53abcb')).toBeTruthy();
	});
});

// ⚠️ ko/ja operators must not be shown English, and a translated state must
// never reach a colour helper that matches English substrings.
describe('translation', () => {
	it('renders the alarm in Korean', async () => {
		await i18n.changeLanguage('ko');
		renderPanel(report({verdict: 'enforcement-offline', storeState: 'unavailable'}));
		expect(screen.queryByText('Token quotas are not being enforced')).toBeNull();
	});

	it('renders the alarm in Japanese', async () => {
		await i18n.changeLanguage('ja');
		renderPanel(report({verdict: 'enforcement-offline', storeState: 'unavailable'}));
		expect(screen.queryByText('Token quotas are not being enforced')).toBeNull();
	});
});
