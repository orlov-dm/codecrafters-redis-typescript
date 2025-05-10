import { isString } from '../../data/helpers';
import { DataType, InternalValueDataType } from '../../data/types';
import { BaseCommand } from './BaseCommand';

export class TypeCommand extends BaseCommand {
    public async process(): Promise<string | null> {
        const [key] = this.getData();
        if (isString(key)) {
            const data = this.getStorage().get(key.value);
            if (!data) {
                const stream = this.getStorage().getStream(key.value);
                if (stream) {
                    return this.encode(
                        InternalValueDataType.TYPE_STREAM,
                        DataType.SimpleString
                    );
                }

                return this.encode(
                    InternalValueDataType.TYPE_NONE,
                    DataType.SimpleString
                );
            } else {
                return this.encode(
                    this.getEncoder().getDataType(data),
                    DataType.SimpleString
                );
            }
        }
        return null;
    }
}
