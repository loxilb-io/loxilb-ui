import i18n from 'i18next';

import enJSON from 'locales/en.json';
import jaJSON from 'locales/ja.json';
import koJSON from 'locales/ko.json';

import {initReactI18next} from 'react-i18next';

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

i18n.use(initReactI18next).init({
	resources,
	lng: default_language,
	fallbackLng: 'en',
	interpolation: {escapeValue: false},
});

export function tmp(key: string) {
	return key;
}

export default i18n;
