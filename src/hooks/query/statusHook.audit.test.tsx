//---------------------------------------------------------
// useGatewayAuditRest — who is asked for /audit/sink
//---------------------------------------------------------
// The status is read for every role; the compliance sink's own read is sent
// only when the caller says the role may have it. The two answers must not
// share a cache entry: a viewer's answer has no sink, and replaying it for an
// operator would drop the address and the error without a read having failed.
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, renderHook, waitFor} from '@testing-library/react';
import React from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {query_get_audit_rest} from 'connector/instance/status';
import {IInstance} from 'types/oam';
import {useGatewayAuditRest} from './statusHook';

vi.mock('connector/instance/status', () => ({
	query_get_capability_status: vi.fn(async () => []),
	query_get_audit_rest: vi.fn(),
	query_get_device_status: vi.fn(),
	query_get_filesystem_status: vi.fn(),
	query_get_process_status: vi.fn(),
	query_get_log_level: vi.fn(),
}));

const INST = {id: 7, name: 'gw'} as unknown as IInstance;
const read = vi.mocked(query_get_audit_rest);

let client: QueryClient;
function wrapper({children}: {children: React.ReactNode}) {
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
	client = new QueryClient();
	read.mockReset();
	read.mockImplementation(async (_inst, opts) => ({kind: 'ok', status: {available: true}, sink: opts.readSink ? {enabled: true} : undefined}));
});
afterEach(() => {
	cleanup();
	client.clear();
});

describe('useGatewayAuditRest', () => {
	it('passes the caller\'s word on /audit/sink to the connector', async () => {
		const {result} = renderHook(() => useGatewayAuditRest(INST, {readSink: false}), {wrapper});
		await waitFor(() => expect(result.current.data).toBeDefined());
		expect(read).toHaveBeenCalledWith(INST, {readSink: false});
	});

	it('reads again when the role resolves to one that may read the sink, instead of replaying the answer without it', async () => {
		const {result, rerender} = renderHook(({readSink}) => useGatewayAuditRest(INST, {readSink}), {wrapper, initialProps: {readSink: false}});
		await waitFor(() => expect(result.current.data).toEqual({kind: 'ok', status: {available: true}, sink: undefined}));
		rerender({readSink: true});
		await waitFor(() => expect(result.current.data).toEqual({kind: 'ok', status: {available: true}, sink: {enabled: true}}));
		expect(read.mock.calls.map(c => c[1])).toEqual([{readSink: false}, {readSink: true}]);
	});

	it('reads nothing without an instance', () => {
		renderHook(() => useGatewayAuditRest(null, {readSink: true}), {wrapper});
		expect(read).not.toHaveBeenCalled();
	});
});
