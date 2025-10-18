import { isString } from '../../../data/helpers';
import { DataType } from '../../../data/types';
import { BaseCommand, type CommandResponse } from '../BaseCommand';

export class RpushCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const [listKeyData, listValueData] = this.getData();
        if (isString(listKeyData) && isString(listValueData)) {
            this.getStorage().addListValue(
                listKeyData.value,
                listValueData.value
            );
            return {
                data: this.getStorage().getListSize(listKeyData.value),
                dataType: DataType.Integer
            };
        }
        return null;
    }
}
