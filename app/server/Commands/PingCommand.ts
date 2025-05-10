import { DataType } from '../../data/types';
import { Responses } from '../const';
import { BaseCommand } from './BaseCommand';

export class PingCommand extends BaseCommand {
    public async process(): Promise<string | null> {
        return this.encode(Responses.RESPONSE_PONG, DataType.SimpleString);
    }
}
