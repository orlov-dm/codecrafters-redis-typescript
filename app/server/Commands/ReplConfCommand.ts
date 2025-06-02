import type { Encoder } from '../../data/Encoder';
import { isString } from '../../data/helpers';
import { Storage } from '../../data/Storage';
import { DataType, type Data } from '../../data/types';
import { Command, Responses } from '../const';
import { BaseCommand, type CommandResponse } from './BaseCommand';

export class ReplConfCommand extends BaseCommand {
    constructor(
        encoder: Encoder,
        storage: Storage,
        commandData: Data[] = [],
        private readonly onListeningPortAdded: (port: number) => void,
        private readonly onResponseAck: () => void
    ) {
        super(encoder, storage, commandData);
    }

    public async process(): Promise<CommandResponse | null> {
        const [subCmdData] = this.getData();
        if (isString(subCmdData)) {
            switch (subCmdData.value) {
                case Command.REPLCONF_LISTENING_PORT_CMD: {
                    const [, listeningPort] = this.getData();
                    const listeningPortValue = Number(listeningPort.value);
                    this.onListeningPortAdded(listeningPortValue);
                    break;
                }
                case Command.REPLCONF_CAPABILITIES_CMD: {
                    console.log('CAPA', this.getData());
                    break;
                }
                case Responses.RESPONSE_ACK: {
                    console.log('Response ACK');
                    this.onResponseAck();
                    return null;
                }
            }
            return {
                data: Responses.RESPONSE_OK,
                dataType: DataType.SimpleString,
            };
        }
        return null;
    }
}
