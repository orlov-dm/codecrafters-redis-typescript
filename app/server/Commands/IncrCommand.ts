import { isString } from '../../data/helpers';
import { DataType } from '../../data/types';
import { ErrorResponses } from '../const';
import { BaseCommand, type CommandResponse } from './BaseCommand';

export class IncrCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const [key] = this.getData();

        if (isString(key)) {
            const value = this.getStorage().incr(key.value);
            if (value === null) {
                return {
                    data: ErrorResponses.RESPONSE_ERROR_INCR_INVALID_INTEGER,
                    dataType: DataType.SimpleError,
                };
            }
            return {
                data: value,
                dataType: DataType.Integer,
            };
        }
        return null;
    }
}
