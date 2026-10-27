import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import i18n from 'locales/i18n';
import {query_get_load_balancer_config_all} from 'connector/instance/load_balancer';
import {query_get_endpoint_all} from 'connector/instance/endpoint';
import {ApiError} from 'connector/fetcher/fetcher_base';
import {IInstance} from 'types/oam';
import {toPageState} from './pageState';
import PageStateBanner from './PageStateBanner';

const instance = {id: 2, name: 'gateway'} as IInstance;
const lists = [
	{name: 'Load Balancer', field: 'lbAttr', read: query_get_load_balancer_config_all},
	{name: 'Endpoint', field: 'Attr', read: query_get_endpoint_all},
];

beforeEach(async () => {
	await i18n.changeLanguage('en');
	vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe.each(lists)('$name list through the HTTP parser, connector and banner', ({name, field, read}) => {
	it.each(['null', 'empty array', 'null body'])('renders a successful %s as empty', async shape => {
		const body = shape === 'null body' ? 'null' : JSON.stringify({[field]: shape === 'null' ? null : []});
		vi.mocked(fetch).mockResolvedValue(new Response(body, {status: 200}));
		const data = await read(instance);
		expect(data).toEqual([]);
		const state = toPageState({data, error: null, dataUpdatedAt: 1}, {op: 'test.list'});
		expect(state.kind).toBe('empty');
		render(<PageStateBanner state={state} name={name} />);
		expect(screen.getByRole('status').textContent).toBe(`No ${name} entries yet`);
	});

	it.each([401, 403])('identifies a Gateway HTTP %i as a management-hop refusal', async status => {
		vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({code: status, message: 'Missing or invalid credentials'}), {
			status, headers: {'X-Loxi-Error-Origin': 'gateway'},
		}));
		const error = await read(instance).catch((failure: unknown) => failure);
		expect(error).toBeInstanceOf(ApiError);
		const state = toPageState({data: undefined, error, dataUpdatedAt: 0}, {op: 'test.list'});
		expect(state.kind).toBe('denied');
		render(<PageStateBanner state={state} name={name} />);
		const text = screen.getByRole('status').textContent;
		expect(text).toContain(status === 401 ? 'Gateway authentication failed' : 'Gateway refused access');
		expect(text).toContain('OAM-to-Gateway management');
		expect(text).not.toContain("You don't have permission");
		expect(text).not.toContain('No ' + name + ' entries yet');
	});

	it('keeps a real OAM permission refusal as a permission error', async () => {
		vi.mocked(fetch).mockResolvedValue(new Response('{}', {status: 403, headers: {'X-Loxi-Error-Origin': 'oam'}}));
		const error = await read(instance).catch((failure: unknown) => failure);
		const state = toPageState({data: undefined, error, dataUpdatedAt: 0}, {op: 'test.list'});
		render(<PageStateBanner state={state} name={name} />);
		expect(screen.getByRole('status').textContent).toContain("You don't have permission");
	});
});
