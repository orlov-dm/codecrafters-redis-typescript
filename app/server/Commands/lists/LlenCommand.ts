import { isString } from '../../../data/helpers';
import { DataType } from '../../../data/types';
import { BaseCommand, type CommandResponse } from '../BaseCommand';

export class LlenCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const [listKeyData] = this.getData();
        if (!isString(listKeyData)) {
            return null;
        }
        return {
            data: this.getStorage().getListSize(listKeyData.value),
            dataType: DataType.Integer,
        };
    }
}
