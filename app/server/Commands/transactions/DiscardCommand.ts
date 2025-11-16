import type { Encoder } from '../../../data/Encoder';
import type { Storage } from '../../../data/Storage';
import { DataType, type Data } from '../../../data/types';
import { ErrorResponses, Responses } from '../../const';
import type { CommandQueueContext } from '../../Server';
import { BaseCommand, type CommandResponse } from '../BaseCommand';

export class DiscardCommand extends BaseCommand {
    constructor(
        encoder: Encoder,
        storage: Storage,
        commandData: Data[] = [],
        private readonly commands: CommandQueueContext[] | null,
        private readonly onDiscard: () => void
    ) {
        super(encoder, storage, commandData);
    }
    public async process(): Promise<CommandResponse | null> {
        if (this.commands === null) {
            return {
                data: ErrorResponses.RESPONSE_ERROR_DISCARD_WITHOUT_MULTI,
                dataType: DataType.SimpleError,
            };
        }
        this.onDiscard();
        return {
            data: Responses.RESPONSE_OK,
            dataType: DataType.SimpleString,
        };
    }
}
