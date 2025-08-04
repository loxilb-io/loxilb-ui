//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box} from '@mui/material';
import BFD from 'assets/image/bfd.svg';
import DEV_NEIGHBOR from 'assets/image/device-neighbors.svg';
import FDB from 'assets/image/forwarding-databases.svg';
import NEIGHBOR from 'assets/image/neighbors.svg';
import ROUTES from 'assets/image/routes.svg';
import {useEffect, useState} from 'react';
import {useLocation} from 'react-router-dom';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BGImage() {
	const location = useLocation();
	const [cur_bg, set_cur_bg] = useState<any>(null);

	const image_set = [
		{
			url_include: 'bfd',
			bg_image: BFD,
		},
		{
			url_include: 'bgp/neighbor',
			bg_image: DEV_NEIGHBOR,
		},
		{
			url_include: 'fdb',
			bg_image: FDB,
		},
		{
			url_include: 'instance/neighbor',
			bg_image: NEIGHBOR,
		},
		{
			url_include: 'instance/route',
			bg_image: NEIGHBOR,
		},
		{
			url_include: 'route',
			bg_image: ROUTES,
		},
		{
			url_include: 'network/fdb',
			bg_image: ROUTES,
		},
		{
			url_include: 'network/bgp/apply',
			bg_image: ROUTES,
		},
		{
			url_include: 'network/bgp/set',
			bg_image: ROUTES,
		},
		{
			url_include: 'network/bgp/neighbor',
		},
		{
			url_include: 'traffic/qos',
			bg_image: ROUTES,
		},
		{
			url_include: 'status/ha',
			bg_image: ROUTES,
		},
		{
			url_include: 'status/fs',
			bg_image: ROUTES,
		},
		{
			url_include: 'status/device',
			bg_image: ROUTES,
		},
	];

	useEffect(() => {
		const bg_image = image_set.find(image => window.location.href.includes(image.url_include))?.bg_image ?? null;
		set_cur_bg(bg_image);
	}, [location]);

	return cur_bg ? <Box position="absolute" right="32px" bottom="16px" component="img" src={cur_bg} zIndex={1} width="140px" sx={{opacity: '70%'}} /> : null;
}
