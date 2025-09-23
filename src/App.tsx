//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {ThemeProvider} from '@emotion/react';
import {createTheme, CssBaseline} from '@mui/material';
import {createSyncStoragePersister} from '@tanstack/query-sync-storage-persister';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {persistQueryClient, persistQueryClientRestore} from '@tanstack/react-query-persist-client';
import {useEffect, useState} from 'react';
import {BrowserRouter, Outlet, Route, Routes} from 'react-router-dom';
import {RecoilRoot} from 'recoil';

import {get_root_url} from 'common';
import {theme_config} from 'theme';

import Layout from 'components/layout/Layout';
import NavLayout from 'components/layout/NavLayout';
import ScrollToTop from 'components/layout/ScrollToTop';
import PopUp from 'components/modal/PopUp';
import SetupHandler from 'components/setup/SetupHandler';

import LoginPage from './pages/LoginPage';
import SimpleSetupPage from 'pages/SimpleSetupPage';
import OAuthCallbackPage from 'pages/OAuthCallbackPage';
import Page404 from 'pages/Page404';
import Page500 from 'pages/Page500';
import Page503 from 'pages/Page503';
import PageCORS from 'pages/PageCORS';

import DashboardPage from 'pages/DashboardPage';
import InstancePage from 'pages/InstancePage';
import InstanceSettingPage from 'pages/InstanceSettingPage';
import SystemPage from 'pages/SystemPage';

import BGPApplyPage from 'pages/network/BGPApplyPage';
import BGPDefinedSetPage from 'pages/network/BGPDefinedSetPage';
import BGPDefinitionPage from 'pages/network/BGPDefinitionPage';
import BGPNeighborPage from 'pages/network/BGPNeighborPage';
import NeighborPage from 'pages/network/DeviceNeighborPage';
import FDBPage from 'pages/network/FDBPage';
import BFDPage from 'pages/network/BFDPage';
import IPPage from 'pages/network/IPPage';
import PortPage from 'pages/network/PortPage';
import RoutePage from 'pages/network/RoutePage';
import VLANPage from 'pages/network/VLANPage';
import VxLANPage from 'pages/network/VXLANPage';

import AlertManagementPage from 'pages/traffic/AlertManagementPage';
import ConntrackPage from 'pages/traffic/ConntrackPage';
import EndpointPage from 'pages/traffic/EndpointPage';
import FirewallPage from 'pages/traffic/FirewallPage';
import LoadBalancerPage from 'pages/traffic/LBRulePage';
import MirrorPage from 'pages/traffic/MirrorPage';
import NetworkTopologyPage from 'pages/traffic/NetworkTopologyPage';
import NTopPage from 'pages/traffic/NTopPage';
import QoSPage from 'pages/traffic/QoSPage';
// import TelecomPage from 'pages/traffic/TelecomPage';

import DevicePage from 'pages/status/DevicePage';
import FileSystemPage from 'pages/status/FileSystemPage';
import HAPage from 'pages/status/HAPage';
import ProcessPage from 'pages/status/ProcessPage';

import AlertManagerPage from 'pages/managers/AlertManagerPage';
import BackupManagerPage from 'pages/managers/BackupManagerPage';
import UserManagementPage from 'pages/managers/UserManagementPage';
import ConfigManagementPage from 'pages/ConfigManagementPage';
import AdvancedMetricsPage from 'pages/AdvancedMetricsPage';

import {MAX_DURATION_MS} from 'hooks/query/common';
import LogPage from 'pages/status/LogPage';
import 'root.css';


//---------------------------------------------------------
// Global Instance
//---------------------------------------------------------
const queryClient = new QueryClient();
const persister = createSyncStoragePersister({storage: window.localStorage});

//---------------------------------------------------------
// Root Component
//---------------------------------------------------------
export default function App() {
	const theme = createTheme(theme_config);
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		persistQueryClientRestore({queryClient, persister}).then(() => {
			persistQueryClient({
				queryClient,
				persister,
				maxAge: MAX_DURATION_MS,
			});
			setIsReady(true);
		});

		const preventRightClick = (event: any) => event.preventDefault();
		document.addEventListener('contextmenu', preventRightClick);
		return () => document.removeEventListener('contextmenu', preventRightClick);
	}, []);

	if (!isReady) return null; // 또는 <LoadingScreen />

	const root_url = get_root_url();

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<RecoilRoot>
				<QueryClientProvider client={queryClient}>
					<BrowserRouter basename={root_url}>
						<ScrollToTop />
						<PopUp />
						<SetupHandler>
							<Routes>
							<Route element={<Layout />}>
								<Route path="/" element={<LoginPage />} />

								<Route path="/404" element={<Page404 />} />
								<Route path="/500" element={<Page500 />} />
								<Route path="/503" element={<Page503 />} />
								<Route path="/cors" element={<PageCORS />} />

								<Route path="/login" element={<LoginPage />} />
								<Route path="/setup" element={<SimpleSetupPage />} />
								<Route path="/oauth/callback" element={<OAuthCallbackPage />} />
								<Route path="/instance" element={<InstancePage />} />
								<Route path="/system" element={<SystemPage />} />
								<Route path="/user" element={<UserManagementPage />} />
								<Route path="/config-management" element={<ConfigManagementPage />} />

								<Route path="/instance/*" element={<NavLayout />}>
									<Route path="network" element={<Outlet />}>
										<Route path="bfd" element={<BFDPage />} />
										<Route path="bgp" element={<Outlet />}>
											<Route path="set" element={<BGPDefinedSetPage />} />
											<Route path="def" element={<BGPDefinitionPage />} />
											<Route path="apply" element={<BGPApplyPage />} />
											<Route path="neighbor" element={<BGPNeighborPage />} />
										</Route>
										<Route path="fdb" element={<FDBPage />} />
										<Route path="ip" element={<IPPage />} />
										<Route path="port" element={<PortPage />} />
										<Route path="neighbor" element={<NeighborPage />} />
										<Route path="route" element={<RoutePage />} />
										<Route path="vlan" element={<VLANPage />} />
										<Route path="vxlan" element={<VxLANPage />} />
									</Route>

									<Route path="traffic" element={<Outlet />}>
										<Route path="alerts" element={<AlertManagementPage />} />
									<Route path="ct" element={<ConntrackPage />} />
										<Route path="endpoint" element={<EndpointPage />} />
										<Route path="fw" element={<FirewallPage />} />
										<Route path="lb" element={<LoadBalancerPage />} />
										<Route path="mirror" element={<MirrorPage />} />
										<Route path="qos" element={<QoSPage />} />
										<Route path="topology" element={<NetworkTopologyPage />} />
										<Route path="ntop" element={<NTopPage />} />
										{/* <Route path="telecom" element={<TelecomPage />} /> */}
									</Route>

									<Route path="status" element={<Outlet />}>
										<Route path="device" element={<DevicePage />} />
										<Route path="fs" element={<FileSystemPage />} />
										<Route path="ha" element={<HAPage />} />
										<Route path="process" element={<ProcessPage />} />
										<Route path="logs" element={<LogPage />} />
									</Route>

									<Route path="managers" element={<Outlet />}>										
										<Route path="alert" element={<AlertManagerPage />} />
										<Route path="backup" element={<BackupManagerPage />} />
										<Route path="metrics" element={<AdvancedMetricsPage />} />
									</Route>

									<Route path="settings" element={<InstanceSettingPage />} />
									<Route path="dashboard" element={<DashboardPage />} />
								</Route>

								<Route path="/*" element={<Page404 />} />
							</Route>
						</Routes>
						</SetupHandler>
					</BrowserRouter>
				</QueryClientProvider>
			</RecoilRoot>
		</ThemeProvider>
	);
}
