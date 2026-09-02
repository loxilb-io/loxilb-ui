//---------------------------------------------------------
// The app's single QueryClient and its localStorage persister.
//
// Extracted from App.tsx for: the session teardown has to purge the
// PERSISTED cache, not just the in-memory one, and it cannot import App
// without a cycle. Keeping both here means there is exactly one client and
// exactly one persister in the process, which is also what makes
// `registerSessionPurge` below able to speak for the whole cache.
//---------------------------------------------------------
import {createSyncStoragePersister} from '@tanstack/query-sync-storage-persister';
import {QueryClient} from '@tanstack/react-query';

export const queryClient = new QueryClient();
export const persister = createSyncStoragePersister({storage: window.localStorage});
