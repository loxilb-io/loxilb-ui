//---------------------------------------------------------
// Each page says which record it shows
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {AuditPathsNote, InstanceLogScopeNote, OamLogScopeNote} from './ScopeNotes';

afterEach(() => {
	cleanup();
});

describe('scope notes', () => {
	it('an instance log is called the operational log of the gateway, not the audit trail', () => {
		render(<InstanceLogScopeNote />);
		const text = screen.getByTestId('instance-log-scope').textContent ?? '';
		expect(text).toContain('operational logs of this gateway');
		expect(text).toContain('They are not the audit trail');
		expect(text).toContain('Audit Trail');
	});

	it('the System log is called the log of the management service, not of a gateway', () => {
		render(<OamLogScopeNote />);
		const text = screen.getByTestId('oam-log-scope').textContent ?? '';
		expect(text).toContain('management service (OAM)');
		expect(text).toContain('not the audit trail of any gateway');
	});

	it('the audit page names the three paths and does not promise receipt', () => {
		render(<AuditPathsNote />);
		const text = screen.getByTestId('audit-paths').textContent ?? '';
		for (const part of ['Management requests', 'Inference traffic', 'Audit records', 'does not prove that a collector received a record']) expect(text).toContain(part);
	});
});
