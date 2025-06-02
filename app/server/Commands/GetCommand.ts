import { isString } from '../../data/helpers';
import { BaseCommand, type CommandResponse } from './BaseCommand';

export class GetCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const [keyData] = this.getData();
        if (isString(keyData) && keyData.value) {
            const value = this.getStorage().get(keyData.value);
            return {
                data: value,
            };
        }
        return null;
    }
}
