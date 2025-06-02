import { isString } from '../../data/helpers';
import type { Data } from '../../data/types';
import { BaseCommand, type CommandResponse } from './BaseCommand';

export class EchoCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        return {
            data: this.getData()
                .map((data) => {
                    if (isString(data)) {
                        return data.value;
                    }
                    return '';
                })
                .join(' '),
        };
    }
}
