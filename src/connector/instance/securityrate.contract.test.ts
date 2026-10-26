import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {request_configure_securityrate, query_get_securityrate_all} from './securityrate';
import type {IInstance} from 'types/oam';
const inst = {id: 1, name: 'gw'} as IInstance;
const config = {synEnabled: false, connRateEnabled: false, udpEnabled: false, synThreshold: 0, cookieThreshold: 0, ratePerSec: 0, udpPktThreshold: 0, udpBandwidthMB: 0, aggregateSynThreshold: 120, whitelistIps: []};
beforeEach(() => {vi.stubGlobal('fetch', vi.fn()); localStorage.clear();});
afterEach(() => vi.unstubAllGlobals());
it('refuses invalid direct connector calls before any request is sent', async () => {
 const result = await request_configure_securityrate(inst, {...config, aggregateSynThreshold: NaN});
 expect(result.status).toBe('invalid'); expect(fetch).not.toHaveBeenCalled();
});
it('preserves explicit zeros and strips client flags and read-only counters', async () => {
 vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({result: 'OK'}), {status: 200}));
 expect((await request_configure_securityrate(inst, {...config, isValid: true, trackingFailures: 15} as any)).status).toBe('confirmed');
 const wire = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
 expect(wire).toEqual(config);
});
it('rejects a malformed 200 read rather than returning an empty list', async () => {
 vi.mocked(fetch).mockResolvedValue(new Response('{}', {status: 200}));
 await expect(query_get_securityrate_all(inst)).rejects.toThrow('Invalid security-rate readback.');
});
it('reads the real fresh-Gateway response without inventing source configuration',async()=>{
 const fresh={aggregateSynThreshold:0,aggregateConnRatePerSec:0,aggregateUdpPktThreshold:0,aggregateUdpBandwidthMB:0,whitelistIps:null};
 vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({securityrateAttr:[fresh]}),{status:200}));
 expect(await query_get_securityrate_all(inst)).toEqual([{...fresh,whitelistIps:[]}]);
});
