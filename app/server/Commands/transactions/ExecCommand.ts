import type { Encoder } from '../../../data/Encoder';
import type { Storage } from '../../../data/Storage';
import { DataType, type Data } from '../../../data/types';
import { ErrorResponses } from '../../const';
import type { CommandQueueContext } from '../../Server';
import { BaseCommand, type CommandResponse } from '../BaseCommand';

export class ExecCommand extends BaseCommand {
    constructor(
        encoder: Encoder,
        storage: Storage,
        commandData: Data[] = [],
        private readonly commands: CommandQueueContext[] | null,
        private readonly onExecStart: (
            commands: CommandQueueContext[]
        ) => Promise<Array<CommandResponse | null>>
    ) {
        super(encoder, storage, commandData);
    }

    public async process(): Promise<CommandResponse | null> {
        throw new Error('not implemented');
    }

    public async processMulti(): Promise<CommandResponse[] | null> {
        if (this.commands === null) {
            return [
                {
                    data: ErrorResponses.RESPONSE_ERROR_EXEC_WITHOUT_MULTI,
                    dataType: DataType.SimpleError,
                },
            ];
        }
        const responses = await this.onExecStart(this.commands);
        if (this.commands.length) {
            return responses
                .filter((response) => response !== null)
                .map((response) => ({
                    data: response.data,
                    dataType: response.dataType,
                }));
        } else {
            return [];
        }
    }
}
