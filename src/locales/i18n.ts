import i18n from 'i18next';

import enJSON from 'locales/en.json';
import jaJSON from 'locales/ja.json';
import koJSON from 'locales/ko.json';

import {initReactI18next} from 'react-i18next';
import {PREFERENCE_KEYS} from 'preferences';

export const default_language = 'en';
//export const default_language = 'cimode';

const resources = {
	en: {translation: enJSON},
	ja: {translation: jaJSON},
	ko: {translation: koJSON},
};

export const support_lang = [
	{code: 'en', name: 'English', flag: 'us'},
	{code: 'ko', name: '한국어', flag: 'kr'},
	{code: 'ja', name: '日本語', flag: 'jp'},
	//{code: 'zh', name: '简体中文', flag: 'cn'},
	//{code: 'fr', name: 'Français', flag: 'fr'},
];

// Apply the persisted language at module init — the earliest point that
// covers EVERY route. The header's language menu also applies it, but the
// header is not mounted on /login, so booting with default_language left a
// ko/ja operator an English login screen and English login errors — a
// defect on the one screen every operator must pass through, found
// by e2e/tests/oam/login-lockout.spec.ts.
function initial_language(): string {
	try {
		const saved = localStorage.getItem(PREFERENCE_KEYS.language);
		if (saved && support_lang.some(lang => lang.code === saved)) return saved;
	} catch {
		// storage unavailable (SSR/tests without the shim) — fall through
	}
	return default_language;
}

i18n.use(initReactI18next).init({
	resources,
	lng: initial_language(),
	fallbackLng: 'en',
	interpolation: {escapeValue: false},
});

// Keep the document language honest from first paint (the a11y/lang gate
// checks <html lang>); LanguageIcon re-syncs it on every later change.
if (typeof document !== 'undefined') document.documentElement.lang = i18n.language;

export function tmp(key: string) {
	return key;
}

export default i18n;
