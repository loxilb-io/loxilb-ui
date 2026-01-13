//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface IServiceArguments {
	name: string;

	externalIP: string;
	inactiveTimeOut: number;
	port: number;
	protocol: string;
	privateIP?: string;
	portMax?: number;
	sel?: number;
	bgp?: boolean;
	monitor?: boolean;
	probetype?: string;
	probeport?: number;
	probereq?: string;
	proberesp?: string;
	managed?: boolean;				// Not required in Edit
	mode?: number;
	security?: number;
	block?: number;
	probeTimeout?: number;
	probeRetries?: number;
	snat?: boolean;
	oper?: number;
	host?: string;
	proxyprotocolv2?: boolean;
	egress?: boolean;
	path_prefix?: string;			// URL path prefix for L7 routing (e.g., /v1/users)
	path_match_mode?: 'disabled' | 'prefix' | 'exact';	// Path matching mode
	llm_type?: string;				// LLM catalog profile name for GPU-aware load balancing
	backend_protocol?: 'http1' | 'http2' | 'both';		// Backend protocol capability for ALPN negotiation
}

export interface IEndpoint {
	endpointIP: string;
	weight: number;
	targetPort: number;
	state: string;					// Not required in Edit					
	counter: string;				// Not required in Edit
}

export interface ISecondaryIP {
	secondaryIP?: string;
}

export interface IAllowedSource {
	prefix: string; // ip address
}

export interface IServiceConfiguration {
	serviceArguments: IServiceArguments;
	endpoints: IEndpoint[];
	secondaryIPs: ISecondaryIP[];
	allowedSources: IAllowedSource[];
}

export interface ILBData {
	lbAttr: IServiceConfiguration[];
}
