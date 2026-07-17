//---------------------------------------------------------
// Typed access to the generated API contracts (src/api/gen/*).
//
// The generated files are produced from the vendored swagger specs by
// `npm run gen:api` (see scripts/gen-api-types.mjs). This module is the
// only place that should import from src/api/gen — connectors import the
// helpers below.
//
//   GwSchema<'LoadbalanceEntry'>            — a gateway model type
//   GwGetResp<'/config/loadbalancer/all'>   — 2xx JSON body of a gateway GET
//   GwPostBody<'/config/loadbalancer'>      — JSON request body of a gateway POST
//   OamSchema<...> / OamGetResp<...>        — same for the OAM server API
//   GwxGetResp<...>                         — gateway extras (raw middleware endpoints)
//---------------------------------------------------------
import type {components as GwComponents, paths as GwPaths} from './gen/gateway';
import type {components as GwxComponents, paths as GwxPaths} from './gen/gateway-extras';
import type {components as OamComponents, paths as OamPaths} from './gen/oam';

export type {GwPaths, GwxPaths, OamPaths};

//---------------------------------------------------------
// Model (definition) lookups
//---------------------------------------------------------
export type GwSchema<K extends keyof GwComponents['schemas']> = GwComponents['schemas'][K];
export type GwxSchema<K extends keyof GwxComponents['schemas']> = GwxComponents['schemas'][K];
export type OamSchema<K extends keyof OamComponents['schemas']> = OamComponents['schemas'][K];

//---------------------------------------------------------
// Operation body extraction
//---------------------------------------------------------
type SuccessCode = 200 | 201 | 202 | 204;

// `{content: never}` (a bodyless 204) must be checked first: matching it
// against the infer pattern would collapse the inferred body type to {}.
type JsonBody<R> = R extends {content: never}
	? undefined
	: R extends {content: {'application/json': infer B}}
	? B
	: never;

type SuccessBody<Op> = Op extends {responses: infer R}
	? {[S in Extract<keyof R, SuccessCode>]: JsonBody<R[S]>}[Extract<keyof R, SuccessCode>]
	: never;

type RequestBody<Op> = Op extends {requestBody?: {content: {'application/json': infer B}}}
	? B
	: Op extends {requestBody: {content: {'application/json': infer B}}}
	? B
	: never;

type GetOf<Paths, P extends keyof Paths> = Paths[P] extends {get: infer Op} ? Op : never;
type PostOf<Paths, P extends keyof Paths> = Paths[P] extends {post: infer Op} ? Op : never;
type PutOf<Paths, P extends keyof Paths> = Paths[P] extends {put: infer Op} ? Op : never;

//---------------------------------------------------------
// Gateway (loxilb-inference-gateway swagger.yml)
//---------------------------------------------------------
export type GwGetResp<P extends keyof GwPaths> = SuccessBody<GetOf<GwPaths, P>>;
export type GwPostResp<P extends keyof GwPaths> = SuccessBody<PostOf<GwPaths, P>>;
export type GwPostBody<P extends keyof GwPaths> = RequestBody<PostOf<GwPaths, P>>;
export type GwPutBody<P extends keyof GwPaths> = RequestBody<PutOf<GwPaths, P>>;

//---------------------------------------------------------
// Gateway extras (raw middleware endpoints, swagger-extras.yml)
//---------------------------------------------------------
export type GwxGetResp<P extends keyof GwxPaths> = SuccessBody<GetOf<GwxPaths, P>>;
export type GwxPostBody<P extends keyof GwxPaths> = RequestBody<PostOf<GwxPaths, P>>;

//---------------------------------------------------------
// OAM server (oam-loxilb swagger)
//---------------------------------------------------------
export type OamGetResp<P extends keyof OamPaths> = SuccessBody<GetOf<OamPaths, P>>;
export type OamPostResp<P extends keyof OamPaths> = SuccessBody<PostOf<OamPaths, P>>;
export type OamPostBody<P extends keyof OamPaths> = RequestBody<PostOf<OamPaths, P>>;
export type OamPutBody<P extends keyof OamPaths> = RequestBody<PutOf<OamPaths, P>>;
