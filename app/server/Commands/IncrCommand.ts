import { isString } from '../../data/helpers';
import { BaseCommand } from './BaseCommand';

export class IncrCommand extends BaseCommand {
    public async process(): Promise<string | null> {
        const [key] = this.getData();

        if (isString(key)) {
            const value = this.getStorage().incr(key.value);
            return this.encode(value);
        }
        return null;
    }
}
