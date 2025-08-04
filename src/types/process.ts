//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface IProcessAttribute {
	pid: string;
	command: string;
	user: string;
	priority: string;
	nice: string;
	virtMemory: string;
	residentSize: string;
	sharedMemory: string;
	status: string;
	CPUUsage: string;
	MemoryUsage: string;
	time: string;
}

export interface IProcessInfo {
	processAttr: IProcessAttribute[];
}
