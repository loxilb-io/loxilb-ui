// Generates TypeScript types from the vendored API specs in api-spec/.
//
// The specs are Swagger 2.0 (both the gateway and the OAM server emit 2.0),
// while openapi-typescript only accepts OpenAPI 3.x — so each spec is
// converted in-memory with swagger2openapi first.
//
// Usage:  npm run gen:api          (regenerate src/api/gen/*)
//         npm run gen:api:check    (regenerate + fail if output drifted)
//
// Spec provenance (re-vendor when the backends change):
//   api-spec/gateway-swagger.yml        <- loxilb-inference-gateway/api/swagger.yml
//   api-spec/gateway-swagger-extras.yml <- loxilb-inference-gateway/api/swagger-extras.yml
//     (raw middleware endpoints that bypass go-swagger codegen; maintained by
//      hand in the gateway repo and intentionally NOT merged into swagger.yml)
//   api-spec/oam-swagger.json           <- oam-loxilb/docs/swagger.json
//      (regenerate there first: swag init --parseDependency --parseInternal -g main.go -o docs)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';
import converter from 'swagger2openapi';
import openapiTS from 'openapi-typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SPECS = [
	{src: 'api-spec/gateway-swagger.yml', out: 'src/api/gen/gateway.ts'},
	{src: 'api-spec/gateway-swagger-extras.yml', out: 'src/api/gen/gateway-extras.ts'},
	{src: 'api-spec/oam-swagger.json', out: 'src/api/gen/oam.ts'},
];

for (const {src, out} of SPECS) {
	const raw = fs.readFileSync(path.join(root, src), 'utf8');
	const doc = src.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw);
	const {openapi} = await converter.convertObj(doc, {patch: true, warnOnly: true, nocert: true});
	const types = await openapiTS(openapi, {
		commentHeader:
			`/**\n` +
			` * Generated from ${src} by scripts/gen-api-types.mjs — DO NOT EDIT.\n` +
			` * Regenerate with: npm run gen:api\n` +
			` */\n\n`,
	});
	const outPath = path.join(root, out);
	fs.mkdirSync(path.dirname(outPath), {recursive: true});
	fs.writeFileSync(outPath, types);
	console.log(`generated ${out} from ${src}`);
}
