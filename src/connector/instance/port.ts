//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IInstance} from 'types/oam';
import {IPortAttribute} from 'types/port';
import {GET_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_port_all(instance: IInstance): Promise<IPortAttribute[]> {
	const resp = await GET_INST(instance, `/config/port/all`);
	return (resp.data?.portAttr as IPortAttribute[]) ?? [];
}
