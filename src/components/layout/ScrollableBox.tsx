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
			{/* tabIndex: the content area is the app's vertical scroll region;
			    a page with no focusable content (read-only metric tables) is
			    otherwise unscrollable by keyboard (WCAG 2.1.1). */}
			<Box id="content-area" tabIndex={0} width="100%" height={area_height} padding="16px" sx={{overflowY: 'auto'}} bgcolor={bgcolor}>
				{children}
			</Box>
		</Box>
	);
}
