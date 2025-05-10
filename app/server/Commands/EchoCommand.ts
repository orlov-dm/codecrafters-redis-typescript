import { isString } from '../../data/helpers';
import type { Data } from '../../data/types';
import { BaseCommand } from './BaseCommand';

export class EchoCommand extends BaseCommand {
    public async process(): Promise<string | null> {
        return this.getData()
            .map((data) => {
                if (isString(data)) {
                    return this.encode(data.value);
                }
                return '';
            })
            .join(' ');
    }
}
