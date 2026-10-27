//---------------------------------------------------------
// Which host interface a network spec may write to.
//
// Kept apart from ./api so the selftest project can drive the choice with no
// environment. On a host-network gateway every address, neighbor or VLAN
// write lands on the host itself, and the gateway manages addresses on every
// host interface: a spec that picks a Docker bridge edits a network that
// belongs to some other workload. Every network spec therefore takes its
// device from pickPrimaryNetworkDevice.
//---------------------------------------------------------

export interface PortAttr {
	portName?: string;
	portNo?: number;
	portSoftwareInformation?: {portActive?: boolean; portType?: number};
}

export interface IpAttr {
	dev: string;
	ipAddress?: string[];
}

/** Loopback, loxilb-owned virtual interfaces and container bridges are never a test target. */
export const BLOCKED_DEVICE = /^(?:lo|llb|vlan|vxlan|ipip|wg|utun|docker|br-)/i;

/** The data-plane port to test on: active before inactive, physical before virtual, then lowest port number. */
export function pickPrimaryNetworkDevice(ports: readonly PortAttr[]): string | undefined {
	return ports
		.filter(port => port.portName && !BLOCKED_DEVICE.test(port.portName))
		.sort((a, b) => {
			const active = Number(Boolean(b.portSoftwareInformation?.portActive)) - Number(Boolean(a.portSoftwareInformation?.portActive));
			if (active) return active;
			const physical = Number(b.portSoftwareInformation?.portType === 1) - Number(a.portSoftwareInformation?.portType === 1);
			if (physical) return physical;
			return (a.portNo ?? Number.MAX_SAFE_INTEGER) - (b.portNo ?? Number.MAX_SAFE_INTEGER);
		})[0]?.portName;
}

/**
 * The first address of `dev` that is not a documentation address and that no
 * other row of the address table carries. The grid is addressed by row text,
 * so an address held by several devices resolves to several rows.
 */
export function uniqueAddressOf(attrs: readonly IpAttr[], dev: string, isDocAddr: (cidr: string) => boolean): string | undefined {
	const bare = (cidr: string) => cidr.split('/')[0];
	const all = attrs.flatMap(a => (a.ipAddress ?? []).map(bare));
	const own = attrs.find(a => a.dev === dev)?.ipAddress ?? [];
	const primary = own.find(cidr => !isDocAddr(cidr) && all.filter(ip => ip === bare(cidr)).length === 1);
	return primary === undefined ? undefined : bare(primary);
}
