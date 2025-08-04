//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IFilesystemInfo} from 'types/filesystem';

//---------------------------------------------------------
// Dummy Data
//---------------------------------------------------------
export const dummyData: IFilesystemInfo = {
	filesystemAttr: [
		{
			fileSystem: '/dev/sda1',
			type: 'ext4',
			size: '512G',
			used: '200G',
			avail: '312G',
			usePercent: '39%',
			mountedOn: '/',
		},
		{
			fileSystem: '/dev/sda2',
			type: 'ext4',
			size: '1T',
			used: '600G',
			avail: '424G',
			usePercent: '59%',
			mountedOn: '/home',
		},
		{
			fileSystem: '/dev/sdb1',
			type: 'xfs',
			size: '2T',
			used: '1.2T',
			avail: '800G',
			usePercent: '60%',
			mountedOn: '/data',
		},
		{
			fileSystem: '/dev/sdc1',
			type: 'ext4',
			size: '500G',
			used: '100G',
			avail: '400G',
			usePercent: '20%',
			mountedOn: '/var',
		},
		{
			fileSystem: 'tmpfs',
			type: 'tmpfs',
			size: '16G',
			used: '2G',
			avail: '14G',
			usePercent: '13%',
			mountedOn: '/tmp',
		},
		{
			fileSystem: '/dev/sdd1',
			type: 'ext4',
			size: '1T',
			used: '750G',
			avail: '250G',
			usePercent: '75%',
			mountedOn: '/backup',
		},
		{
			fileSystem: '/dev/sde1',
			type: 'btrfs',
			size: '4T',
			used: '2.5T',
			avail: '1.5T',
			usePercent: '63%',
			mountedOn: '/storage',
		},
		{
			fileSystem: '/dev/mapper/vg0-lv0',
			type: 'ext4',
			size: '2T',
			used: '1.5T',
			avail: '500G',
			usePercent: '75%',
			mountedOn: '/var/lib/docker',
		},
	],
};
