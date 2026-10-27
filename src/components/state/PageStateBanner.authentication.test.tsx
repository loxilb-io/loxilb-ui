import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {ApiError} from 'connector/fetcher/fetcher_base';
import i18n from 'locales/i18n';
import en from 'locales/en.json';
import ko from 'locales/ko.json';
import ja from 'locales/ja.json';
import PageStateBanner from './PageStateBanner';
import {toPageState} from './pageState';

const cases = [
	{status: 401, origin: 'gateway', key: 'Gateway authentication failed while loading {{name}}. Check the OAM-to-Gateway management credentials.'},
	{status: 403, origin: 'gateway', key: 'Gateway refused access to {{name}}. Check the OAM-to-Gateway management permissions.'},
	{status: 401, origin: undefined, key: 'Authentication failed while loading {{name}}.'},
];

afterEach(async () => {
	cleanup();
	await i18n.changeLanguage('en');
});

describe.each([['en', en], ['ko', ko], ['ja', ja]] as const)('authentication banner in %s', (language, catalogue) => {
	it.each(cases)('renders HTTP $status from $origin using a translated headline', async ({status, origin, key}) => {
		await i18n.changeLanguage(language);
		const headers = new Headers(origin ? {'X-Loxi-Error-Origin': origin} : {});
		const error = new ApiError('private server diagnostic', status, {data: null, headers});
		const state = toPageState({data: undefined, error, dataUpdatedAt: 0}, {op: 'test.list'});
		render(<PageStateBanner state={state} name="Resource" />);
		const translated = (catalogue as Record<string, string>)[key];
		expect(translated).toBeTruthy();
		if (language !== 'en') expect(translated).not.toBe(key);
		expect(screen.getByRole('status').textContent).toContain(translated.replace('{{name}}', 'Resource'));
		expect(screen.getByRole('status').textContent).not.toContain('private server diagnostic');
		expect(screen.queryByText('No Resource entries yet')).toBeNull();
	});
});
