import test from 'node:test';
import assert from 'node:assert/strict';
import {ESLint} from 'eslint';

const lint = new ESLint();
async function rules(code, filePath = 'src/lint-policy-fixture.tsx') {
	const [result] = await lint.lintText(code, {filePath});
	assert.ok(result, 'fixture must be included in the lint gate');
	assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
	return new Set(result.messages.map(message => message.ruleId));
}

test('console output remains an error', async () => {
	assert.ok((await rules("export function example() { console.log('unexpected'); }")).has('no-console'));
});

test('legacy unmounted react-query imports remain rejected', async () => {
	assert.ok((await rules("import {useQuery} from 'react-query'; export {useQuery};")).has('no-restricted-imports'));
});

test('invalid numeric input cannot silently become an unlimited zero', async () => {
	assert.ok((await rules('export const parse = (value: string) => parseInt(value) || 0;')).has('no-restricted-syntax'));
});

test('new timed blind refetches fail while the exact existing deferred path remains deferred', async () => {
	const code = 'export function reconcile(refetch: () => void) { setTimeout(() => refetch(), 1000); }';
	assert.ok((await rules(code)).has('no-restricted-syntax'));
	assert.ok(!(await rules(code, 'src/pages/ipsec/IPsecTunnelPage.tsx')).has('no-restricted-syntax'));
});

test('accessibility keyboard gate remains active', async () => {
	assert.ok((await rules('export const Example = () => <div onClick={() => {}}>Action</div>;')).has('jsx-a11y/click-events-have-key-events'));
});

test('conditional React hooks remain rejected', async () => {
	const code = "import {useEffect} from 'react'; export function Example({flag}: {flag: boolean}) { if (flag) useEffect(() => {}, []); return null; }";
	assert.ok((await rules(code)).has('react-hooks/rules-of-hooks'));
});
