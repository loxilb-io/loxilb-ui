import {useState} from 'react';

export function useInstanceFromURL() { return {id: 1, name: 'local-fixture'}; }
export function useRole() { return {is_viewer: false}; }
export function useStatus() {
	const [refresh, setRefresh] = useState(0);
	const processAttr = new URLSearchParams(window.location.search).has('empty') ? [] : [{
		pid: '123', command: 'loxilb', user: 'root', priority: '20', nice: '0', status: 'S',
		CPUUsage: String(refresh), MemoryUsage: '1.0', time: '0:00.01',
		virtMemory: '1024', residentSize: '512', sharedMemory: '128',
	}];
	return {processAttr, psQuery: {data: processAttr, error: null, dataUpdatedAt: 1, isLoading: false, isError: false}, refetch: () => setRefresh(n => n + 1)};
}
