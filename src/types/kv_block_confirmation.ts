import {effectiveAIHash, isAIEngineChange, resolveAITopology} from './ai_gateway';
import {IServiceArguments} from './load_balancer';

/** Confirm a new or changed KV contract, without attesting unchanged routing during unrelated edits. */
export function requiresKvBlockConfirmation(current: IServiceArguments, original?: IServiceArguments): boolean {
	if (![1, 3].includes(current.kvExactMode ?? 0)) return false;
	if (!original) return true;
	return resolveAITopology(current) !== resolveAITopology(original)
		|| current.kvBlockSize !== original.kvBlockSize
		|| isAIEngineChange(original.kvEngineType, current.kvEngineType)
		|| (current.kvHashAlgo || effectiveAIHash(current.kvEngineType)) !== (original.kvHashAlgo || effectiveAIHash(original.kvEngineType))
		|| (current.kvModelProfile || '') !== (original.kvModelProfile || '')
		|| (current.kvExactApiMode || '') !== (original.kvExactApiMode || '')
		|| (current.model_name || '') !== (original.model_name || '');
}
