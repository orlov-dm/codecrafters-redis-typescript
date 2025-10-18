import { isString } from '../../../data/helpers';
import { DataType } from '../../../data/types';
import { BaseCommand, type CommandResponse } from '../BaseCommand';

export class RpushCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const [listKeyData, ...listValuesData] = this.getData();
        if (isString(listKeyData)) {
            const listValues = listValuesData.filter(isString).map(data => data.value);
            this.getStorage().addListValues(
                listKeyData.value,
                listValues
            );
            return {
                data: this.getStorage().getListSize(listKeyData.value),
                dataType: DataType.Integer
            };
        }
        return null;
    }
}
