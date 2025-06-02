import type { Encoder } from '../../data/Encoder';
import type { Storage } from '../../data/Storage';
import { DataType, type Data, type InternalValueType } from '../../data/types';
import type { CommandQueueContext } from '../Server';
import { BaseCommand, type CommandResponse } from './BaseCommand';

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
                    data: 'ERR EXEC without MULTI',
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
