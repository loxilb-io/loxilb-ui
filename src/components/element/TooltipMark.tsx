//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {Tooltip} from '@mui/material';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function TooltipMark({color, content}: {content: string; color?: string}) {
	const iconColor = color || 'grey.600';

	return (
		<Tooltip title={content} placement="top" arrow>
			<InfoOutlinedIcon sx={{color: iconColor, fontSize: '16px'}} />
		</Tooltip>
	);
}
