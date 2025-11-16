import { isString } from "../../../data/helpers";
import { DataType, type Data } from "../../../data/types";
import { Responses } from "../../const";
import { BaseCommand, type CommandResponse } from "../BaseCommand";

export class UnsubscribeCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const [channelName] = this.getData();
        if (!isString(channelName)) {
            return null;
        }

        const connection = this.getConnection();
        if (!connection) {
            return null;
        }
        const channelsCount = this.getStorage().unsubscribe(connection, channelName.value);

        return {
            data: [
                Responses.RESPONSE_UNSUBSCRIBE,
                channelName.value,
                channelsCount,
            ],
            dataTypePerArrayItem: 
                [DataType.BulkString, DataType.BulkString, DataType.Integer],            
        };
    }
}