import { isString } from '../../../data/helpers';
import { BaseCommand, type CommandResponse } from '../BaseCommand';

export class LpopCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const [listKeyData, countData] = this.getData();
        if (!isString(listKeyData)) {
            return null;
        }

        if (countData !== undefined) {
            if (!isString(countData)) {
                return null;
            }
            return {
                data: this.getStorage().listPopMultiple(
                    listKeyData.value,
                    Number(countData.value)
                ),
            };
        }
        return {
            data: this.getStorage().listPop(listKeyData.value),
        };
    }
}
