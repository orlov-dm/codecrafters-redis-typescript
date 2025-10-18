import { isNumber, isString } from '../../../data/helpers';
import { BaseCommand, type CommandResponse } from '../BaseCommand';

export class LrangeCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const [listKeyData, startData, endData] = this.getData();
        if (
            !isString(listKeyData) ||
            !isString(startData) ||
            !isString(endData)
        ) {
            return null;
        }
        return {
            data: this.getStorage().getListValues(
                listKeyData.value,
                Number(startData.value),
                Number(endData.value)
            ),
        };
    }
}
