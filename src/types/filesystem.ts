//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface IFilesystemAttribute {
	fileSystem: string;
	type: string;
	size: string;
	used: string;
	avail: string;
	usePercent: string;
	mountedOn: string;
}

export interface IFilesystemInfo {
	filesystemAttr: IFilesystemAttribute[];
}
