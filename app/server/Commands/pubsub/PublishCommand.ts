import { isString } from "../../../data/helpers";
import { DataType } from "../../../data/types";
import { BaseCommand, type CommandResponse } from "../BaseCommand";

export class PublishCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const [channelName, message] = this.getData();
        if (!isString(channelName) || !isString(message)) {
            return null;
        }

        const connections = this.getStorage().getSubscribedConnections(channelName.value);
        for (const connection of connections) {
            connection.write(
                this.getEncoder().encode(message.value)
            )
        }

        return {
            data: connections.length,
            dataType: DataType.Integer,               
        };
    }
}