import { isString } from '../../data/helpers';
import { BaseCommand, type CommandResponse } from './BaseCommand';

export class KeysCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const [searchData] = this.getData();
        if (isString(searchData)) {
            const key = searchData.value === '*' ? null : searchData.value;
            return { data: this.getStorage().keys(key) };
        }
        return null;
    }
}
