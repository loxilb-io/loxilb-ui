//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {get_local_storage, remove_local_storage, save_local_storage} from 'common';
import {query_get_alerts} from 'connector/oam/alerts';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {IAlert} from 'types/alert';
import {useMyInfo} from './query/oamHooks';

const ALERT_STORAGE_KEY = 'received_alerts';
const POLLING_INTERVAL_MS = parseInt(process.env.REACT_APP_REPATCH_INTERVAL || '5000');

//---------------------------------------------------------
// Hook
//---------------------------------------------------------
export function useAlertManager() {
	const my_info = useMyInfo();
	const [alerts, setAlerts] = useState<IAlert[]>([]);

	const delete_alerts = (id: number) => {
		setAlerts(prev => {
			const updated = prev.filter(a => a.id !== id);
			save_local_storage(ALERT_STORAGE_KEY, JSON.stringify(updated));
			return updated;
		});
	};

	const fetch_alerts = useCallback(async () => {
		const resp = await query_get_alerts(1, 10);
		if (!resp || !Array.isArray(resp.data)) return;

		const savedRaw = get_local_storage(ALERT_STORAGE_KEY);
		const savedAlerts: IAlert[] = savedRaw ? JSON.parse(savedRaw) : [];
		const resolvedMap = new Map<number, string>();
		savedAlerts.forEach(a => {
			if (a.resolved_at) {
				resolvedMap.set(a.id, a.resolved_at);
			}
		});

		const merged = resp.data.map(alert => {
			if (resolvedMap.has(alert.id)) return {...alert, resolved_at: resolvedMap.get(alert.id)!};
			else return alert;
		});

		setAlerts(merged);
		save_local_storage(ALERT_STORAGE_KEY, JSON.stringify(merged));
	}, [my_info]);

	useEffect(() => {
		const saved = get_local_storage(ALERT_STORAGE_KEY);
		if (saved) {
			try {
				setAlerts(JSON.parse(saved));
			} catch {
				remove_local_storage(ALERT_STORAGE_KEY);
			}
		}

		void fetch_alerts();
		const timer = setInterval(() => {
			void fetch_alerts();
		}, POLLING_INTERVAL_MS);
		return () => clearInterval(timer);
	}, [fetch_alerts]);

	const has_new_alert = useMemo(() => alerts.some(alert => !alert.resolved_at), [alerts]);
	const resolve_alert = useCallback((id: number) => {
		setAlerts(prev => {
			const updated = prev.map(alert => {
				if (alert.id === id) return {...alert, resolved_at: new Date().toISOString()};

				return alert;
			});

			save_local_storage(ALERT_STORAGE_KEY, JSON.stringify(updated));
			return updated;
		});
	}, []);

	return {alerts, fetch_alerts, delete_alerts, has_new_alert, resolve_alert};
}
