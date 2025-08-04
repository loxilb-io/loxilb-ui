//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {query_get_neighbor_all} from 'connector/instance/device_neghbors';
import {query_get_device_status} from 'connector/instance/status';
import {IInstance} from 'types/oam';
import {useQueryInstanceData} from './common';

//---------------------------------------------------------
// Functions
//---------------------------------------------------------
export function useDeviceNeighbors(instance: IInstance | null) {
	return useQueryInstanceData(['device_neighbors'], query_get_neighbor_all, instance);
}

export function useDeviceStatus(instance: IInstance | null) {
	return useQueryInstanceData(['device_status'], query_get_device_status, instance);
}
