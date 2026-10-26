/** Prefix identity for Gateway CIDR readback, including host-bit masking.
 * No DNS, scoped IPv6, legacy octal IPv4, or abbreviated IPv4 is accepted.
 */
export function networkPrefixKey(input: string): string | undefined {
	if (typeof input !== 'string') return undefined;
	const pieces = input.trim().split('/');
	if (pieces.length > 2 || (pieces.length === 2 && !/^\d+$/.test(pieces[1]))) return undefined;
	const ip = pieces[0];
	const v4 = (text: string): number[] | undefined => {
		const octets = text.split('.');
		return octets.length === 4 && octets.every(s => /^(0|[1-9]\d{0,2})$/.test(s) && Number(s) <= 255) ? octets.map(Number) : undefined;
	};
	let units: number[]; let width: number; let family: string;
	if (ip.includes(':')) {
		if (!/^[a-fA-F0-9:.]+$/.test(ip) || (ip.includes('.') && !v4(ip.slice(ip.lastIndexOf(':') + 1)))) return undefined;
		let host: string;
		try {host = new URL(`http://[${ip}]/`).hostname.slice(1, -1);} catch {return undefined;}
		const [left, right] = host.split('::');
		const a = left ? left.split(':').map(s => parseInt(s, 16)) : [];
		const b = right ? right.split(':').map(s => parseInt(s, 16)) : [];
		units = right === undefined ? a : [...a, ...Array(8 - a.length - b.length).fill(0), ...b];
		width = 16; family = 'v6';
	} else {
		const parsed = v4(ip); if (!parsed) return undefined;
		units = parsed; width = 8; family = 'v4';
	}
	let bits = pieces.length === 2 ? Number(pieces[1]) : units.length * width;
	if (!Number.isInteger(bits) || bits < 0 || bits > units.length * width) return undefined;
	// Go's IPNet.String reports IPv4-mapped prefixes as IPv4 when /96+.
	if (family === 'v6' && bits >= 96 && units.slice(0, 5).every(n => n === 0) && units[5] === 65535) {
		units = [units[6] >> 8, units[6] & 255, units[7] >> 8, units[7] & 255]; bits -= 96; width = 8; family = 'v4';
	}
	const masked = units.map((n, i) => {
		const keep = Math.max(0, Math.min(width, bits - i * width));
		return keep === 0 ? 0 : n & (((1 << keep) - 1) << (width - keep));
	});
	return `${family}:${masked.join(':')}/${bits}`;
}

export const validGatewayCidr = (input: string): boolean => typeof input === 'string' && input.includes('/') && networkPrefixKey(input) !== undefined;
