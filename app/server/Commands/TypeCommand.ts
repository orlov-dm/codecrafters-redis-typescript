import { isString } from '../../data/helpers';
import { DataType, InternalValueDataType } from '../../data/types';
import { BaseCommand, type CommandResponse } from './BaseCommand';

export class TypeCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const [key] = this.getData();
        if (isString(key)) {
            const data = this.getStorage().get(key.value);
            if (!data) {
                const stream = this.getStorage().getStream(key.value);
                if (stream) {
                    return {
                        data: InternalValueDataType.TYPE_STREAM,
                        dataType: DataType.SimpleString,
                    };
                }

                return {
                    data: InternalValueDataType.TYPE_NONE,
                    dataType: DataType.SimpleString,
                };
            } else {
                return {
                    data: this.getEncoder().getDataType(data),
                    dataType: DataType.SimpleString,
                };
            }
        }
        return null;
    }
}
