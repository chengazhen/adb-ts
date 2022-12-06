import { MonkeyCallback, NotConnectedError } from '..';
import { Socket } from 'net';
import { Reply, ErrReply } from './reply';
import Api from './api';
import Command from './command';
import CommandQueue from './commandqueue';
import Parser from './parser';

export default class Monkey extends Api {
    public readonly queue: Command[] = [];
    private parser: Parser = new Parser();
    protected stream_?: Socket;
    private timeout?: NodeJS.Timeout;

    get stream(): Socket {
        if (!this.stream_) {
            throw new NotConnectedError();
        }
        return this.stream_;
    }

    send(commands: string[] | string, cb: MonkeyCallback): this {
        [commands].flat().forEach((command) => {
            this.queue.push(new Command(command, cb));
            this.stream.write(command + '\n');
        });

        this.timeout = setTimeout(() => {
            this.consume(new ErrReply('Command failed'));
        }, 500);

        return this;
    }

    protected hook(): void {
        this.stream.on('data', (data) => {
            clearTimeout(this.timeout);
            return this.parser.parse(data);
        });
        this.stream.on('error', (err) => {
            clearTimeout(this.timeout);
            return this.emit('error', err);
        });
        this.stream.on('end', () => {
            clearTimeout(this.timeout);
            return this.emit('end');
        });
        this.stream.on('finish', () => {
            clearTimeout(this.timeout);
            return this.emit('finish');
        });
        this.parser.on('reply', (reply) => {
            return this.consume(reply);
        });
        this.parser.on('error', (err) => {
            return this.emit('error', err);
        });
    }

    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'finish', listener: () => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    private consume(reply: Reply): void {
        const command = this.queue.shift();
        if (!command) {
            this.end();
            this.emit(
                'error',
                new Error('Command queue depleted, but replies still coming in')
            );
            return;
        }

        if (reply.isError()) {
            return command.callback?.(reply.toError(), null, command.command);
        }

        command.callback?.(null, reply.value, command.command);
    }

    connect(param: Socket): this {
        this.stream_ = param;
        this.hook();
        return this;
    }

    end(cb?: () => void): this {
        clearTimeout(this.timeout);
        this.stream.end(cb);
        return this;
    }

    commandQueue(): CommandQueue {
        return new CommandQueue(this);
    }
}
