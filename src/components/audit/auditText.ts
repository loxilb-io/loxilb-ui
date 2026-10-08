//---------------------------------------------------------
// Audit Trail page: labels, input errors, and what to say after a change
//---------------------------------------------------------
import type {TFunction} from 'i18next';
import {OpResult} from 'connector/fetcher/opResult';
import {opErrorText} from 'connector/fetcher/opResultText';
import {AUDIT_MAX_ENTERPRISE_NUMBER, AUDIT_MAX_FACILITY, AUDIT_MAX_FRAME_BYTES, AuditInputError} from 'types/audit_config';

export function auditFieldLabel(field: string, t: TFunction): string {
	switch (field) {
		case 'max_segment_bytes':
			return t('Seal a segment at (bytes)');
		case 'max_segment_age_seconds':
			return t('Seal a segment after (seconds)');
		case 'retention_max_age_seconds':
			return t('Delete sealed segments older than (seconds)');
		case 'retention_max_bytes':
			return t('Keep at most (bytes of sealed segments)');
		case 'retention_reserve_bytes':
			return t('Free space to keep on the audit filesystem (bytes)');
		case 'retention_max_prune_per_pass':
			return t('Deletions per retention pass');
		case 'name':
			return t('Name');
		case 'address':
			return t('Receiver address (host:port)');
		case 'ca_bundle_path':
			return t('CA bundle path');
		case 'server_name':
			return t('Server name in the certificate');
		case 'client_cert_path':
			return t('Client certificate path');
		case 'client_key_path':
			return t('Client key path');
		case 'facility':
			return t('Syslog facility');
		case 'max_frame_bytes':
			return t('Largest message (bytes)');
		case 'enterprise_number':
			return t('Enterprise number');
		case 'filter':
			return t('Filter');
		case 'streams':
			return t('Streams');
		case 'services':
			return t('Services');
		case 'outcome':
			return t('Outcome');
		case 'data_sample':
			return t('Keep one data record in');
		case 'enabled':
			return t('Whether the sink exists');
		default:
			return field;
	}
}

/** What 0 or blank means for the field, shown under it. */
export function auditFieldHelp(field: string, t: TFunction): string | undefined {
	switch (field) {
		case 'max_segment_bytes':
			return t('0 never seals by size.');
		case 'max_segment_age_seconds':
			return t('0 never seals by age: the unsealed part of the trail then grows without bound.');
		case 'retention_max_age_seconds':
			return t('0 keeps sealed segments by age forever.');
		case 'retention_max_bytes':
			return t('0 sets no quota. A quota below one segment is refused.');
		case 'retention_reserve_bytes':
			return t('Below this, the oldest segments are deleted whatever their age, and audited management changes are refused. 0 turns the check off.');
		case 'retention_max_prune_per_pass':
			return t('0 is read back as 1, the built-in default.');
		case 'name':
			return t('1 to 64 of a-z, 0-9, "-" and "_". It cannot be changed afterwards.');
		case 'ca_bundle_path':
			return t('A file on the gateway host. The receiver is always verified; there is no unverified mode.');
		case 'server_name':
			return t('Blank uses the host part of the address.');
		case 'client_cert_path':
		case 'client_key_path':
			return t('For mutual TLS. Set both or neither.');
		case 'facility':
			return t('0 to {{max}}. Blank uses 13 (log audit).', {max: AUDIT_MAX_FACILITY});
		case 'max_frame_bytes':
			return t('A record that does not fit is shortened at a field boundary and marked. Blank sets no limit.');
		case 'enterprise_number':
			return t('The IANA private enterprise number that qualifies the export sequence. Required; none is built in.');
		case 'services':
			return t('Comma separated. Keeps data records of these services only; other streams are not judged by it. Blank keeps all.');
		case 'data_sample':
			return t('Blank keeps every data record. Only the data stream is sampled.');
		default:
			return undefined;
	}
}

export function auditInputErrorText(field: string, error: AuditInputError, t: TFunction): string {
	switch (error) {
		case 'not_whole':
			return t('Enter a whole number, 0 or more.');
		case 'too_large':
			return t('This number is larger than the gateway can hold.');
		case 'below_segment':
			return t('A quota below one segment can never be met. Use 0 for no quota, or at least the segment size.');
		case 'required':
			return t('Required.');
		case 'address':
			return t('Enter one host and one port, such as siem.example:6514. An IPv6 host goes in brackets.');
		case 'pair':
			return t('The client certificate and its key go together: set both or neither.');
		case 'name':
			return t('Use 1 to 64 of a-z, 0-9, "-" and "_".');
		case 'reserved_name':
			return t('This name belongs to the compliance sink.');
		case 'service':
			return t('A service name is empty. Remove the extra comma.');
		case 'out_of_range': {
			const max = field === 'facility' ? AUDIT_MAX_FACILITY : field === 'max_frame_bytes' ? AUDIT_MAX_FRAME_BYTES : AUDIT_MAX_ENTERPRISE_NUMBER;
			return t('Enter a number from {{min}} to {{max}}.', {min: field === 'enterprise_number' ? 1 : 0, max});
		}
		default:
			return t('Not valid.');
	}
}

export interface IChangeReport {
	severity: 'success' | 'warning' | 'error';
	text: string;
	/** True when the change did not go through and the form should stay open with its input. */
	keepInput: boolean;
}

/**
 * What the readback said after a change: `match`, the fields that differ, or
 * `unreadable` when the read failed.
 */
export type AuditReadback = 'match' | 'unreadable' | string[];

/**
 * A change is reported from what the gateway reads back, not from what the
 * write answered: the audit handlers answer 204 with no body, so the answer
 * says "accepted" and nothing about what is now held.
 */
export function reportAuditChange(res: OpResult, readback: AuditReadback, t: TFunction): IChangeReport {
	const fields = Array.isArray(readback) ? readback.map(f => auditFieldLabel(f, t)).join(', ') : '';
	if (res.status === 'confirmed') {
		if (readback === 'match') return {severity: 'success', text: t('Saved. The gateway reads back what was sent.'), keepInput: false};
		if (readback === 'unreadable') return {severity: 'warning', text: t('The change was accepted, but it could not be read back. Refresh before relying on it.'), keepInput: false};
		return {severity: 'warning', text: t('The change was accepted, but the gateway reads back something else for: {{fields}}.', {fields}), keepInput: false};
	}
	if (res.status === 'unknown') {
		if (readback === 'match') return {severity: 'success', text: t('No answer came back for the change, but the gateway now reads back what was sent.'), keepInput: false};
		if (readback === 'unreadable') return {severity: 'warning', text: t('No answer came back for the change, and the state could not be read back. Refresh before sending it again.'), keepInput: true};
		return {severity: 'warning', text: t('No answer came back for the change, and the gateway does not read back what was sent ({{fields}}). It may not have been applied: check before sending it again.', {fields}), keepInput: true};
	}
	// Every refusal of an audit handler is a 400 with no body.
	if (res.httpStatus === 400) {
		return {severity: 'error', text: t('The gateway refused these values (400) and does not say which one. Nothing was changed, and what you entered is kept.'), keepInput: true};
	}
	return {severity: 'error', text: opErrorText(res), keepInput: true};
}

export const reportTitle = (report: IChangeReport, t: TFunction): string => (report.severity === 'success' ? t('Success') : report.severity === 'warning' ? t('Warning') : t('Error'));
