import { isString } from '../../../data/helpers';
import { BaseCommand, type CommandResponse } from '../BaseCommand';

export class LpopCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const [listKeyData] = this.getData();
        if (!isString(listKeyData)) {
            return null;
        }
        return {
            data: this.getStorage().listPop(listKeyData.value),
        };
    }
}
