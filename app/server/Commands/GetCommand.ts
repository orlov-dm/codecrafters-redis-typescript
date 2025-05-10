import { isString } from '../../data/helpers';
import { BaseCommand } from './BaseCommand';

export class GetCommand extends BaseCommand {
    public async process(): Promise<string | null> {
        const [keyData] = this.getData();
        if (isString(keyData) && keyData.value) {
            const getValue = this.getStorage().get(keyData.value);
            return this.encode(getValue);
        }
        return null;
    }
}
