import type { Encoder } from '../../data/Encoder';
import { isString } from '../../data/helpers';
import type { Storage } from '../../data/Storage';
import type { Data } from '../../data/types';
import { BaseCommand } from './BaseCommand';

export class WaitCommand extends BaseCommand {
    constructor(
        encoder: Encoder,
        storage: Storage,
        commandData: Data[] = [],
        private readonly onWait: (
            numReplicas: number,
            timeout: number
        ) => Promise<number>
    ) {
        super(encoder, storage, commandData);
    }
    public async process(): Promise<string | null> {
        const [numReplicas, timeout] = this.getData();
        console.log('WAIT_CMD ', numReplicas, timeout);

        if (isString(timeout) && isString(numReplicas)) {
            const acks = await this.onWait(
                Number(numReplicas.value),
                Number(timeout.value)
            );
            return this.encode(acks);
        }
        return null;
    }
}
