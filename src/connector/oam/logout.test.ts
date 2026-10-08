import {afterEach, expect, it, vi} from 'vitest';
import {request_logout} from './oam';
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
it('captures the current token and preserves logout delivery through navigation', async () => {
 const fetchMock=vi.fn(async()=>new Response('{}',{status:200}));vi.stubGlobal('fetch',fetchMock);
 localStorage.setItem('access_token','original');const pending=request_logout();localStorage.removeItem('access_token');await pending;
 expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/logout$/),expect.objectContaining({keepalive:true,headers:expect.objectContaining({Authorization:'Bearer original'})}));
});
it('network refusal does not reject local teardown',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('fixture offline')}));localStorage.setItem('access_token','token');
 await expect(request_logout()).resolves.toBeUndefined();
});
