import { isString } from '../../../data/helpers';
import { DataType } from '../../../data/types';
import { BaseCommand, type CommandResponse } from '../BaseCommand';

export class LpushCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const [listKeyData, ...listValuesData] = this.getData();
        if (!isString(listKeyData)) {
            return null;
        }
        const listValues = listValuesData
            .filter(isString)
            .map((data) => data.value);
        this.getStorage().prependListValues(listKeyData.value, listValues);
        return {
            data: this.getStorage().getListSize(listKeyData.value),
            dataType: DataType.Integer,
        };
    }
}
