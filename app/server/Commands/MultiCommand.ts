import { Responses } from '../const';
import { BaseCommand } from './BaseCommand';

export class MultiCommand extends BaseCommand {
    public async process(): Promise<string | null> {
        return this.encode(Responses.RESPONSE_OK);
    }
}
