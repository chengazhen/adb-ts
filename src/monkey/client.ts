import { MonkeyCallback, NotConnectedError } from '..';
import { Socket } from 'net';
import { Reply, ErrReply } from './reply';
import Api from './api';
import { BaseCommand, Command, ParsableCommand } from './command';
import CommandQueue from './commandqueue';
import Parser from './parser';

export default class Monkey extends Api {
    public readonly queue: BaseCommand<any>[] = [];
    private parser: Parser = new Parser();
    private stream_?: Socket;
    private timeout?: NodeJS.Timeout;

    get stream(): Socket {
        if (!this.stream_) {
            throw new NotConnectedError();
        }
        return this.stream_;
    }

    private sendInternal(
        commands: string[] | string,
        cmdConstruct: (cmd: string) => BaseCommand<any>
    ): this {
        [commands].flat().forEach((command) => {
            this.queue.push(cmdConstruct(command));
            this.stream.write(command + '\n');
        });

        this.timeout = setTimeout(() => {
            this.consume(new ErrReply('Command failed'));
        }, 500);

        return this;
    }

    sendAndParse<T>(
        commands: string | string[],
        cb: MonkeyCallback<T>,
        parser: (data: string | null) => T
    ): this {
        return this.sendInternal(
            commands,
            (cmd) => new ParsableCommand(cmd, cb, parser)
        );
    }

    send(commands: string[] | string, cb: MonkeyCallback): this {
        return this.sendInternal(commands, (cmd) => new Command(cmd, cb));
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
    on(event: 'end' | 'finish' | 'close', listener: () => void): this;
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

        if (command.isParsable()) {
            return command.callback?.(
                null,
                command.parser(reply.value),
                command.command
            );
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
