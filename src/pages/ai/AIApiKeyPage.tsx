//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {Alert, IconButton, Stack, Tooltip, Typography} from '@mui/material';
import SingleTextField from 'components/element/SingleTextField';
import ValueBunch from 'components/element/ValueBunch';
import ApiKeyInputForm from 'components/input/ApiKeyInputForm';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import ApiKeyTable from 'components/table/ai/ApiKeyTable';
import {request_create_apikey, request_delete_apikey} from 'connector/instance/ai';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useApiKeys} from 'hooks/query/queryHooks';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {t} from 'i18next';
import React, {Fragment, useRef, useState} from 'react';
import {IApiKeyCreateRequest, IApiKeyCreateResponse, IApiKeySummary} from 'types/ai';

//---------------------------------------------------------
// Functional Components
//---------------------------------------------------------

// The plaintext key exists ONLY in this popup — it cannot be fetched again.
function RawKeyPanel(props: {created: IApiKeyCreateResponse}) {
	const {created} = props;
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		if (!created.raw_key) return;
		navigator.clipboard?.writeText(created.raw_key).then(() => setCopied(true));
	};

	return (
		<Stack spacing={2}>
			<Alert severity="warning">{t('Copy this key now — it is shown only once and cannot be retrieved later.')}</Alert>
			{created.key_id && <SingleTextField label={t('Key ID')} value={created.key_id} />}
			<Stack direction="row" spacing={1} alignItems="center">
				<Typography sx={{fontFamily: 'monospace', wordBreak: 'break-all', flex: 1}}>{created.raw_key}</Typography>
				<Tooltip title={copied ? t('Copied!') : t('Copy to clipboard')}>
					<IconButton onClick={handleCopy} size="small">
						<ContentCopyIcon fontSize="small" />
					</IconButton>
				</Tooltip>
			</Stack>
		</Stack>
	);
}

function ImportedKeyPanel(props: {created: IApiKeyCreateResponse}) {
	return (
		<Stack spacing={2}>
			<Alert severity="success">{t('The existing API key was registered. Its secret is not returned or stored by this UI.')}</Alert>
			{props.created.key_id && <SingleTextField label={t('Key ID')} value={props.created.key_id} />}
		</Stack>
	);
}

function DetailPanel(props: {data: IApiKeySummary}) {
	const {data} = props;

	return (
		<SubTitlePannel title={data.name || data.key_id || ''} sub_title={t('Details')}>
			<Stack spacing={2}>
				<ValueBunch name={t('Identity')}>
					<SingleTextField label={t('Key ID')} value={data.key_id} />
					<SingleTextField label={t('Tenant')} value={data.tenant_id} />
					<SingleTextField label={t('Name')} value={data.name} />
					<SingleTextField label={t('Enabled')} value={data.enabled === false ? 'No' : 'Yes'} />
				</ValueBunch>
				<ValueBunch name={t('Limits')}>
					<SingleTextField label={t('Allowed Models')} value={(data.allowed_models ?? []).join(', ') || t('All models')} />
					<SingleTextField label={t('Rate Limit (req/s)')} value={(data.rate_limit_rps ?? 0).toString()} />
					<SingleTextField label={t('Burst Size')} value={(data.burst_size ?? 0).toString()} />
					<SingleTextField label={t('Tokens / Minute')} value={(data.tokens_per_min ?? 0).toString()} />
				</ValueBunch>
				<ValueBunch name={t('Lifecycle')}>
					<SingleTextField label={t('Created At')} value={data.created_at} />
					<SingleTextField label={t('Expires At')} value={data.expires_at || t('Never')} />
				</ValueBunch>
			</Stack>
		</SubTitlePannel>
	);
}

export default function AIApiKeyPage() {
	const inst = useInstanceFromURL();

	const {data, isError, refetch} = useApiKeys(inst);
	// Defense in depth: even though the connector normalizes to an array, never
	// spread an unchecked hook result (a gateway 402 body is a non-iterable object).
	const keys = React.useMemo(() => {
		const rows = Array.isArray(data) ? data : [];
		return [...rows].sort((a, b) => (a.key_id ?? '').localeCompare(b.key_id ?? ''));
	}, [data]);

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();

	// selected_rows holds a stable hash of key_id (the row id the table assigns),
	// so selection tracks the key across refetches/re-sorts, not array position.
	const selectedKey = selected_rows.length === 1 ? keys.find(k => getStableHash(k.key_id ?? '') === selected_rows[0]) ?? null : null;

	const formRef = useRef<IApiKeyCreateRequest | null>(null);
	const handleAdd = () => {
		if (!inst) return;
		formRef.current = null;

		const input_form = (
			<ApiKeyInputForm
				key={Date.now()}
				onDispose={() => {
					formRef.current = null;
				}}
				onChange={data => {
					const {isValid, ...cleanData} = data;
					formRef.current = cleanData;
					enableYes(isValid);
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Add'),
			t('Cancel'),
			async () => {
				if (!formRef.current) return;

				const request = formRef.current;
				const imported = request.api_key !== undefined;
				formRef.current = null;
				const res = await request_create_apikey(inst, request);
				if (res.status === 'success' && res.created) {
					if (imported) {
						openPopUp(t('API Key Imported'), <ImportedKeyPanel created={res.created} />, t('OK'));
					} else if (res.created.raw_key) {
						openPopUp(t('API Key Created'), <RawKeyPanel created={res.created} />, t('OK'));
					} else {
						showAddError('AI API key', t('The Gateway did not return the one-time generated key. The key cannot be recovered; delete the metadata and create a new key.'));
						return;
					}
					setTimeout(() => {
						refetch();
					}, 1000);
				} else showAddError('AI API key', res.error);
			},
			true,
		);
	};

	const handleDelete = async () => {
		if (!inst || selected_rows.length === 0) return;

		const targets = selected_rows.map(hash => keys.find(k => getStableHash(k.key_id ?? '') === hash)).filter((item): item is IApiKeySummary => !!item?.key_id);
		if (targets.length === 0) return;

		const results = await Promise.all(targets.map(item => request_delete_apikey(inst, item.key_id!)));
		const failures = results.filter(res => res.status === 'error');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('AI API key', `${results.length - failures.length} succeeded, ${failures.length} failed: ${failures[0].error}`);
		} else {
			showDeleteError('AI API key', failures[0].error);
			return;
		}
		set_selected_rows([]);
		setTimeout(() => {
			refetch();
		}, 1000);
	};

	const handleRefresh = () => {
		set_selected_rows([]);
		refetch();
	};

	return (
		<Fragment>
			<ApiKeyTable
				data={keys}
				selected_rows={selected_rows}
				onChangeSelectedRows={set_selected_rows}
				onAdd={handleAdd}
				onDelete={handleDelete}
				onRefresh={handleRefresh}
				error={!!isError}
			/>
			{selectedKey && (
				<LowerSection>
					<DetailPanel data={selectedKey} />
				</LowerSection>
			)}

			{/* Error Popup */}
			<ErrorPopUp
				isOpen={errorPopup.isOpen}
				onClose={closeErrorPopup}
				title={errorPopup.title}
				mainMessage={errorPopup.mainMessage}
				errorData={errorPopup.errorData}
				buttonText={t('OK')}
			/>
		</Fragment>
	);
}
