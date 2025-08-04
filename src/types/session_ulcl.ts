//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface IUlclArgument {
	qfi: number;
	ulclIP: string;
}

export interface IUlclAttribute {
	ulclIdent: string;
	ulclArgument: IUlclArgument;
}

export interface IUlclConfiguration {
	ulclAttr: IUlclAttribute[];
}
