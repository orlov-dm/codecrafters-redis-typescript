import type { Encoder } from '../../../data/Encoder';
import type { Storage } from '../../../data/Storage';
import {
    StreamErrorCode,
    type Entry,
    type KeyValue,
} from '../../../data/Stream';
import { isString } from '../../../data/helpers';
import { DataType, type Data } from '../../../data/types';
import { BaseCommand, type CommandResponse } from '../BaseCommand';

export class XAddCommand extends BaseCommand {
    constructor(
        encoder: Encoder,
        storage: Storage,
        commandData: Data[] = [],
        private readonly onAdd: (
            streamKey: string,
            entryId: string,
            values: Data[]
        ) => [Entry | null, StreamErrorCode]
    ) {
        super(encoder, storage, commandData);
    }

    public async process(): Promise<CommandResponse | null> {
        const [streamKey, entryId, ...rest] = this.getData();
        console.log('XAdd', streamKey, entryId, rest);
        if (isString(streamKey) && isString(entryId)) {
            const [result, errorCode] = this.onAdd(
                streamKey.value,
                entryId.value,
                rest
            );
            if (result) {
                return {
                    data: result.id,
                    dataType: DataType.BulkString,
                };
            } else {
                if (errorCode === StreamErrorCode.ID_IS_SMALLER_OR_EQUAL) {
                    return {
                        data: 'ERR The ID specified in XADD is equal or smaller than the target stream top item',
                        dataType: DataType.SimpleError,
                    };
                } else if (errorCode === StreamErrorCode.ID_IS_ZERO) {
                    return {
                        data: 'ERR The ID specified in XADD must be greater than 0-0',
                        dataType: DataType.SimpleError,
                    };
                }
                return { data: null };
            }
        }

        return null;
    }
}
