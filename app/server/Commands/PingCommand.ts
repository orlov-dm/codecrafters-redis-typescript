import { DataType, type Data } from '../../data/types';
import { Responses } from '../const';
import { BaseCommand, type CommandResponse } from './BaseCommand';

export class PingCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const connection = this.getConnection()
        if (connection && this.getStorage().isUserInSubscribedMode(connection)) {
            return {
                data: [Responses.RESPONSE_PONG.toLowerCase(), ''],                
            }
        }
        return {
            data: Responses.RESPONSE_PONG,
            dataType: DataType.SimpleString,
        };
    }
}
