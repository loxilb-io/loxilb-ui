//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface ISystemInfo {
	hostName: string;
	machineID: string;
	bootID: string;
	OS: string;
	kernel: string;
	architecture: string;
	uptime: string;
	/** Absolute boot timestamp, pre-computed from the raw uptime seconds
	 *  (the `uptime` field above is already human-formatted, so it cannot be
	 *  re-parsed for this). Optional so callers building a blank default may
	 *  omit it. */
	bootTime?: string;
}
