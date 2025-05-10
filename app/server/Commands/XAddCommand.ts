import type { Encoder } from '../../data/Encoder';
import type { Storage } from '../../data/Storage';
import { isString } from '../../data/helpers';
import { DataType, type Data } from '../../data/types';
import { BaseCommand } from './BaseCommand';

export class XAddCommand extends BaseCommand {
    constructor(
        encoder: Encoder,
        storage: Storage,
        commandData: Data[] = [],
        private readonly onAdd: (
            streamKey: string,
            entryId: string,
            key: string,
            value: Data
        ) => void
    ) {
        super(encoder, storage, commandData);
    }
    public async process(): Promise<string | null> {
        const [streamKey, entryId, key, value] = this.getData();
        if (isString(streamKey) && isString(entryId) && isString(key)) {
            this.onAdd(streamKey.value, entryId.value, key.value, value);
            return this.encode(entryId.value, DataType.BulkString);
        }

        return null;
    }
}
