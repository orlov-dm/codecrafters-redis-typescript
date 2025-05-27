import type { Encoder } from '../../data/Encoder';
import type { Storage } from '../../data/Storage';
import { DataType, type Data } from '../../data/types';
import { Command, Responses } from '../const';
import type { CommandQueueContext } from '../Server';
import { BaseCommand } from './BaseCommand';

export class ExecCommand extends BaseCommand {
    constructor(
        encoder: Encoder,
        storage: Storage,
        commandData: Data[] = [],
        private readonly commands: CommandQueueContext[] | null,
        private readonly onExecStart: (commands: CommandQueueContext[]) => void
    ) {
        super(encoder, storage, commandData);
    }
    public async process(): Promise<string | null> {
        if (this.commands === null) {
            return this.encode('ERR EXEC without MULTI', DataType.SimpleError);
        }
        this.onExecStart(this.commands);
        if (this.commands.length) {
            return this.encode(Responses.RESPONSE_OK);
        } else {
            return this.encode([]);
        }
    }
}
