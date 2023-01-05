import { StatsObject } from '../util/types';
import StreamHandler from '../streamHandler';

export class PushTransfer extends StreamHandler {
    private readonly stack: number[] = [];
    private readonly stats: StatsObject = {
        bytesTransferred: 0
    };

    cancel(): void {
        this.emit('cancel');
    }

    push(byteCount: number): void {
        this.stack.push(byteCount);
    }

    pop(): void {
        const byteCount = this.stack.pop();
        this.stats.bytesTransferred += byteCount || 0;
        this.emit('progress', this.stats);
    }

    end(): void {
        this.emit('end');
    }

    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'end' | 'cancel', listener: () => void): this;
    on(event: 'progress', listener: (stats: StatsObject) => void): this;
    on(event: string, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }
}
