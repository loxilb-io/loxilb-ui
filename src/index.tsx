//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ReactDOM from 'react-dom/client';

// Self-hosted UI fonts (variable weights). Pretendard's dynamic-subset build
// only downloads the Hangul ranges a page actually uses.
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';

import App from './App';

import 'locales/i18n';
import {hydrate} from 'react-dom';

//---------------------------------------------------------
// Initialization
//---------------------------------------------------------
const root_element = document.getElementById('root') as HTMLElement;
const root = ReactDOM.createRoot(root_element);

//---------------------------------------------------------
// Entry Point
//---------------------------------------------------------
if (root_element.hasChildNodes()) hydrate(<App />, root_element); // for react-snap
else root.render(<App />);
