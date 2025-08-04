//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box} from '@mui/material';
import {ReactNode, useEffect, useRef, useState} from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ScrollableBox(props: {children?: ReactNode; bgcolor?: string}) {
	const {children, bgcolor} = props;

	const area_ref = useRef<HTMLDivElement>(null);
	const [area_height, set_area_height] = useState(500);

	useEffect(() => {
		if (!area_ref.current) return;

		const observer = new ResizeObserver(entries => {
			const entry = entries[0];
			set_area_height(entry.contentRect.height);
		});

		observer.observe(area_ref.current);

		return () => observer.disconnect();
	}, []);

	return (
		<Box id="outer-box" ref={area_ref} width="100%" height="100%" display="flex">
			<Box id="content-area" width="100%" height={area_height} padding="16px" sx={{overflowY: 'auto'}} bgcolor={bgcolor}>
				{children}
			</Box>
		</Box>
	);
}
