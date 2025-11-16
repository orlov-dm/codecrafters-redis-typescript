import type { Encoder } from '../../data/Encoder';
import type { Data, DataType, InternalValueType } from '../../data/types';
import { Storage } from '../../data/Storage';

export interface CommandResponse {
    data: InternalValueType;
    dataType?: DataType;
    dataTypePerArrayItem?: DataType[];
}

export abstract class BaseCommand {
    constructor(
        private readonly encoder: Encoder,
        private readonly storage: Storage,
        private readonly commandData: Data[] = [],
    ) {}

    public abstract process(): Promise<CommandResponse | null>;
    public async processMulti(): Promise<CommandResponse[] | null> {
        return null;
    }

    protected encode(
        data: InternalValueType | null,
        enforceDataType?: DataType
    ): string {
        return this.encoder.encode(data, { enforceDataType });
    }

    protected getEncoder() {
        return this.encoder;
    }

    protected getData() {
        return this.commandData;
    }

    protected getStorage() {
        return this.storage;
    }
}
