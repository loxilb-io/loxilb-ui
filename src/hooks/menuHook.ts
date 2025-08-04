//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {menu_states_atom} from 'atoms';
import {useRecoilState} from 'recoil';
import {IMenuItem, MENU_LIST} from 'types/menu';

type Path = string[];

//---------------------------------------------------------
// Hook
//---------------------------------------------------------
export default function useMenuState() {
	const [menu_state, set_menu_state] = useRecoilState<Record<string, boolean>>(menu_states_atom);

	const findItemByPath = (path: Path): IMenuItem | undefined => {
		if (!Array.isArray(path) || path.length === 0) return undefined;

		let current: IMenuItem | undefined = MENU_LIST.find(item => item?.name === path[0]);

		for (let i = 1; i < path.length && current?.items; i++) {
			if (!path[i]) continue;
			else current = current.items.find(item => item?.name === path[i]);
		}

		return current;
	};

	const findParentItem = (path: Path): IMenuItem | undefined => {
		if (!Array.isArray(path) || path.length <= 1) return undefined;
		else return findItemByPath(path.slice(0, -1));
	};

	const findSiblingPaths = (targetPath: Path): Path[] => {
		if (!Array.isArray(targetPath) || targetPath.length === 0) return [];

		if (targetPath.length === 1) return MENU_LIST.filter(item => item?.name && item.name !== targetPath[0]).map(item => [item.name]);

		const parentItem = findParentItem(targetPath);
		if (!parentItem?.items) return [];

		const parentPath = targetPath.slice(0, -1);
		const currentName = targetPath[targetPath.length - 1];

		return parentItem.items.filter(item => item?.name && item.name !== currentName).map(item => [...parentPath, item.name]);
	};

	const createPathKey = (path: Path): string => {
		if (!Array.isArray(path)) return '';
		else return path.filter(Boolean).join('/');
	};

	const toggleMenuState = (path: Path, state?: boolean) => {
		if (!Array.isArray(path) || path.length === 0) return;

		set_menu_state(prev => {
			const updates: Record<string, boolean> = {};
			const pathKey = createPathKey(path);

			if (!pathKey) return prev;

			const newState = state !== undefined ? state : !prev[pathKey];

			if (newState) {
				const segments = pathKey.split('/');
				let currentPath = '';
				segments.forEach(segment => {
					if (!segment) return;
					currentPath = currentPath ? `${currentPath}/${segment}` : segment;
					updates[currentPath] = true;
				});

				const siblingPaths = findSiblingPaths(path);

				siblingPaths.forEach(siblingPath => {
					const siblingKey = createPathKey(siblingPath);
					if (!siblingKey) return;

					updates[siblingKey] = false;
					Object.keys(prev).forEach(key => {
						if (key.startsWith(siblingKey + '/')) updates[key] = false;
					});
				});
			} else {
				updates[pathKey] = false;
				Object.keys(prev).forEach(key => {
					if (key.startsWith(pathKey + '/')) updates[key] = false;
				});
			}

			return {...prev, ...updates};
		});
	};

	const closeAllMenuState = () => {
		set_menu_state({});
	};

	const getMenuState = (path: Path): boolean => {
		if (!Array.isArray(path)) return false;

		const pathKey = createPathKey(path);
		return pathKey ? menu_state[pathKey] ?? false : false;
	};

	return {
		toggleMenuState,
		getMenuState,
		closeAllMenuState,
		menu_state,
		createPathKey,
	};
}
