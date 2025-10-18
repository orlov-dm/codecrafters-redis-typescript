import { isString } from '../../../data/helpers';
import { BaseCommand, type CommandResponse } from '../BaseCommand';

export class BlpopCommand extends BaseCommand {
    public async process(): Promise<CommandResponse | null> {
        const [listKeyData, timeoutData] = this.getData();
        if (!isString(listKeyData) || !isString(timeoutData)) {
            return null;
        }

        const listKey = listKeyData.value;
        const timeoutMs = Number(timeoutData.value) * 1000;

        let value = this.getStorage().listPop(listKey);

        if (value !== null) {
            return {
                data: [listKey, value],
            };
        }

        await this.waitForValue(listKey, timeoutMs);

        return {
            data: [listKey, this.getStorage().listPop(listKey)],
        };
    }

    private waitForValue(listKey: string, timeoutMs: number) {
        return new Promise((resolve) => {
            let resolved = false;

            let timeoutId: Timer | null = null;
            // Periodically check for new values
            const intervalId = setInterval(() => {
                if (this.getStorage().getListSize(listKey) > 0) {
                    clearInterval(intervalId);
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }
                    resolved = true;
                    resolve(true);
                }
            }, 10); // Poll every 10ms

            if (timeoutMs > 0) {
                timeoutId = setTimeout(() => {
                    if (!resolved) {
                        clearInterval(intervalId);
                        resolve(false);
                    }
                }, timeoutMs);
            }
        });
    }
}
