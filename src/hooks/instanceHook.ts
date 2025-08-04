//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';
import {IInstance} from 'types/oam';
import {useInstances} from './query/oamHooks';

//---------------------------------------------------------
// Hook
//---------------------------------------------------------
export function useInstanceFromURL(): IInstance | null {
	const [searchParams] = useSearchParams();
	const {instance_list} = useInstances();
	const name = searchParams.get('name');

	return useMemo(() => {
		if (!name) return null;
		else return instance_list.find(item => item.name === name) || null;
	}, [name, instance_list]);
}
