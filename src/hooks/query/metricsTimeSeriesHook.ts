//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {query_get_conntrack_all} from 'connector/instance/conn_track';
import {ICtData} from 'types/conn_track';
import {createTimeSeriesHook} from './common';

//---------------------------------------------------------
// Hook Instances
//---------------------------------------------------------
// Client-side accumulation of /config/conntrack/all snapshots, used by the
// ConntrackPage detail panel to derive per-connection rates.
export const useConntrackSeries = createTimeSeriesHook('conntrack-series', 'conntrack', query_get_conntrack_all, raw => raw as ICtData);
