// Real page and controlled DataGrid; only the server-facing hooks are fixtures.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {RecoilRoot} from 'recoil';
import '../../../src/locales/i18n';
import ProcessPage from '../../../src/pages/status/ProcessPage';
createRoot(document.getElementById('root')).render(<RecoilRoot><main style={{padding: 24}}><ProcessPage /></main></RecoilRoot>);
