import { isString } from '../../data/helpers';
import { DataType, type Data } from '../../data/types';
import { Responses } from '../const';
import { BaseCommand, type CommandResponse } from './BaseCommand';

export class SetCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const [keyData, valueData, pxData, pxValue] = this.getData();
        if (isString(keyData) && keyData.value) {
            const hasPxArg =
                pxData &&
                isString(pxData) &&
                pxData?.value?.toLowerCase() === 'px';
            const expirationMs = hasPxArg ? Number(pxValue.value) : 0;
            this.getStorage().set(keyData.value, valueData, expirationMs);
        }
        return {
            data: Responses.RESPONSE_OK,
            dataType: DataType.SimpleString,
        };
    }
}
