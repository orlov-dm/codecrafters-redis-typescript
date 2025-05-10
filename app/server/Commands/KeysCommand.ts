import { isString } from '../../data/helpers';
import { BaseCommand } from './BaseCommand';

export class KeysCommand extends BaseCommand {
    public async process(): Promise<string | null> {
        const [searchData] = this.getData();
        if (isString(searchData)) {
            const key = searchData.value === '*' ? null : searchData.value;
            return this.encode(this.getStorage().keys(key));
        }
        return null;
    }
}
