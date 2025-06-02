import type { Socket } from 'net';
import type { Encoder } from '../../data/Encoder';
import { isString } from '../../data/helpers';
import type { Storage } from '../../data/Storage';
import { DataType, DELIMITER, type Data } from '../../data/types';
import { RDBStorage } from '../../rdb/const';
import { Responses, UNKNOWN } from '../const';
import { BaseCommand, type CommandResponse } from './BaseCommand';

export class PsyncCommand extends BaseCommand {
    constructor(
        encoder: Encoder,
        storage: Storage,
        commandData: Data[] = [],
        private readonly connection: Socket,
        private readonly serverId: string,
        private readonly replicationOffset: number
    ) {
        super(encoder, storage, commandData);
    }

    public async process(): Promise<CommandResponse | null> {
        const [replIdData, replOffsetData] = this.getData();

        if (
            isString(replIdData) &&
            replIdData.value === UNKNOWN &&
            isString(replOffsetData) &&
            Number(replOffsetData.value) === -1
        ) {
            const writeData = this.encode(
                `${Responses.RESPONSE_FULLRESYNC} ${this.serverId} ${this.replicationOffset}`,
                DataType.SimpleString
            );
            this.connection.write(writeData);

            const fileContent = this.getStorage().getFileContent();
            if (fileContent) {
                this.connection.write(
                    Buffer.concat([
                        Buffer.from(
                            `$${fileContent.length}${DELIMITER}`,
                            RDBStorage.SOURCE_ENCODING
                        ),
                        fileContent,
                    ])
                );
            }
            return null;
        }

        return {
            data: `${replIdData.type} '${replIdData.value}' , ${replOffsetData.type} '${replOffsetData.value}'`,
            dataType: DataType.SimpleString,
        };
    }
}
