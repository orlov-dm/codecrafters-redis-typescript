import { isString } from '../../data/helpers';
import { DataType } from '../../data/types';
import { BaseCommand } from './BaseCommand';

export class IncrCommand extends BaseCommand {
    public async process(): Promise<string | null> {
        const [key] = this.getData();

        if (isString(key)) {
            const value = this.getStorage().incr(key.value);
            if (value === null) {
                return this.encode(
                    'ERR value is not an integer or out of range',
                    DataType.SimpleError
                );
            }
            return this.encode(value, DataType.Integer);
        }
        return null;
    }
}
