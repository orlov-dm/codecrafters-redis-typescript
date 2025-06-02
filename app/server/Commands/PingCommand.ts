import { DataType } from '../../data/types';
import { Responses } from '../const';
import { BaseCommand, type CommandResponse } from './BaseCommand';

export class PingCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        return {
            data: Responses.RESPONSE_PONG,
            dataType: DataType.SimpleString,
        };
    }
}
