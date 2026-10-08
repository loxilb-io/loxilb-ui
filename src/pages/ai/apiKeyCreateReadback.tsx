//---------------------------------------------------------
// A new API key, checked against its own read
//---------------------------------------------------------
// The create answers with the key's ID and, once, its secret. It does not say
// what was stored. The key's own read (GET /config/ai/apikey/{key_id}) does,
// so each field that was asked for is compared with it and the result is said
// next to the secret: the dialog that shows the secret is the only result
// dialog a create has.
//---------------------------------------------------------
import {Alert} from '@mui/material';
import {query_get_apikey} from 'connector/instance/ai';
import {ApiKeyCreateField, apiKeyCreateDiff} from 'hooks/query/confirmPredicates';
import {t} from 'i18next';
import React from 'react';
import {IApiKeyCreateRequest} from 'types/ai';
import {IInstance} from 'types/oam';

/**
 * `match`, the fields that read back differently, `missing` when the gateway
 * does not find the key it just named, or `unreadable` when the read failed
 * or the create named no key to read.
 */
export type ApiKeyCreateReadback = 'match' | 'missing' | 'unreadable' | ApiKeyCreateField[];

/** Never rejects: a read that fails is `unreadable`, and the key was still created. */
export async function readBackCreatedApiKey(instance: IInstance, keyId: string | undefined, request: IApiKeyCreateRequest): Promise<ApiKeyCreateReadback> {
	if (!keyId) return 'unreadable';
	try {
		const served = await query_get_apikey(instance, keyId);
		if (served === null) return 'missing';
		// A read that names another key says nothing about this one.
		if (served.key_id !== keyId) return 'unreadable';
		const differing = apiKeyCreateDiff(request, served);
		return differing.length === 0 ? 'match' : differing;
	} catch {
		return 'unreadable';
	}
}

const fieldLabel = (field: ApiKeyCreateField): string => {
	switch (field) {
		case 'tenant_id':
			return t('Tenant');
		case 'name':
			return t('Name');
		case 'allowed_models':
			return t('Allowed Models');
		case 'rate_limit_rps':
			return t('Rate Limit (req/s)');
		case 'burst_size':
			return t('Burst Size');
		case 'tokens_per_min':
			return t('Tokens / Minute');
		case 'expires_at':
			return t('Expires At');
		case 'enabled':
			return t('Enabled');
	}
};

export function ApiKeyCreateReadbackNote(props: {readback: ApiKeyCreateReadback}) {
	const {readback} = props;
	if (readback === 'match') return <Alert severity="success">{t('The gateway reads this key back with the values that were sent.')}</Alert>;
	if (readback === 'missing') {
		return <Alert severity="warning">{t('The key was created, but the gateway does not find it by its ID. Check the list before giving the key out.')}</Alert>;
	}
	if (readback === 'unreadable') {
		return <Alert severity="warning">{t('The key was created, but it could not be read back. Check its values in the list before relying on them.')}</Alert>;
	}
	return (
		<Alert severity="warning">
			{t('The key was created, but the gateway reads back something else for: {{fields}}. Check its values in the list before relying on them.', {
				fields: readback.map(fieldLabel).join(', '),
			})}
		</Alert>
	);
}
