//---------------------------------------------------------
// Reading a gateway's maintenance state.
//
// `state` alone says only that an operator declared maintenance, which closes
// the management plane to configuration writes. Whether inference traffic is
// being drained is a separate answer, `refusing_new_inference`: true only on
// a gateway whose data path is attached. A management plane with nothing
// behind it is in maintenance and drains nothing, and a screen that inferred
// a drain from `state` would tell an operator to wait for one that is not
// happening.
//
// The counters are observations, not a verdict. `in_flight_requests` counts
// what the capacity gate holds as executing and is 0 when no pool is gated,
// `in_flight_streams` counts open SSE sessions only; neither reaching zero
// proves traffic has drained.
//---------------------------------------------------------
import type {IMaintenanceStatus} from 'connector/instance/maintenance';

export type MaintenancePhase =
	/** Normal operation. */
	| 'active'
	/** Configuration writes refused AND new inference refused: a drain is in progress. */
	| 'draining'
	/** Configuration writes refused; inference is NOT refused, nothing drains. */
	| 'config-only'
	/** In maintenance, on a gateway that does not say whether inference is refused. */
	| 'maintenance-unreported'
	/** A state this UI does not know, shown as sent. */
	| 'unknown';

export function maintenancePhase(status: Pick<IMaintenanceStatus, 'state' | 'refusing_new_inference'> | undefined): MaintenancePhase {
	if (status?.state === 'active') return 'active';
	if (status?.state !== 'maintenance') return 'unknown';
	if (status.refusing_new_inference === true) return 'draining';
	if (status.refusing_new_inference === false) return 'config-only';
	return 'maintenance-unreported';
}

/**
 * Executing inference requests, or undefined when the gateway did not say.
 *
 * The gateway leaves the counter out when it is zero, so on a gateway that
 * reports inference refusal — the same release that added the counter — an
 * absent counter is a reported zero. On one that reports neither, absence is
 * a gateway that has no such counter, and zero would be made up.
 */
export function inFlightRequests(status: Pick<IMaintenanceStatus, 'in_flight_requests' | 'refusing_new_inference'>): number | undefined {
	if (typeof status.in_flight_requests === 'number') return status.in_flight_requests;
	return typeof status.refusing_new_inference === 'boolean' ? 0 : undefined;
}

/** The drain window an operator may declare on enter: whole seconds, uint32; empty declares none. */
export function parseDrainWindow(input: string): {seconds?: number; error?: 'not-a-whole-number' | 'too-large'} {
	const text = input.trim();
	if (text === '') return {};
	if (!/^\d+$/.test(text)) return {error: 'not-a-whole-number'};
	const seconds = Number(text);
	if (seconds > 0xffffffff) return {error: 'too-large'};
	return {seconds};
}
