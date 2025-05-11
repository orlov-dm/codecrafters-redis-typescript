import type { InternalValueType } from './types';

interface Entry {
    id: string;
    key: string;
    value: InternalValueType;
}

export enum StreamErrorCode {
    NO_ERROR = 0,
    ID_IS_SMALLER_OR_EQUAL = 1,
    ID_IS_ZERO = 2,
}

export class Stream {
    private entries: Entry[] = [];

    constructor(private readonly key: string) {}

    public addEntry(entry: Entry): [boolean, StreamErrorCode] {
        const [validationResult, validationError] = this.isEntryValid(entry);
        if (!validationResult) {
            return [false, validationError];
        }
        this.entries.push(entry);
        return [true, validationError];
    }

    public getKey() {
        return this.key;
    }

    private isEntryValid(entry: Entry): [boolean, StreamErrorCode] {
        const [ms, sequence] = entry.id.split('-').map(Number);
        if (ms <= 0 && sequence <= 0) {
            return [false, StreamErrorCode.ID_IS_ZERO];
        }
        const lastEntry = this.entries[this.entries.length - 1];
        if (lastEntry) {
            const [prevMs, prevSequence] = lastEntry.id.split('-').map(Number);
            if (ms < prevMs) {
                return [false, StreamErrorCode.ID_IS_SMALLER_OR_EQUAL];
            } else if (ms === prevMs) {
                if (sequence <= prevSequence) {
                    return [false, StreamErrorCode.ID_IS_SMALLER_OR_EQUAL];
                }
            }
        }

        return [true, StreamErrorCode.NO_ERROR];
    }
}
