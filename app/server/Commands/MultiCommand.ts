import type { Encoder } from '../../data/Encoder';
import type { Storage } from '../../data/Storage';
import type { Data } from '../../data/types';
import { Responses } from '../const';
import { BaseCommand } from './BaseCommand';

export class MultiCommand extends BaseCommand {
    constructor(
        encoder: Encoder,
        storage: Storage,
        commandData: Data[] = [],
        private readonly onMultiStart: () => void
    ) {
        super(encoder, storage, commandData);
    }
    public async process(): Promise<string | null> {
        this.onMultiStart();
        return this.encode(Responses.RESPONSE_OK);
    }
}
