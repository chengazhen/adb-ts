import { AdbMock } from '../../mockery/mockAdbServer';
import AdbClient from '../../lib/client';
import { FailError, UnexpectedDataError } from '../../lib';
import fs, { WriteStream } from 'fs';
import { BufferWritableMock } from 'stream-mock';
import { Writable } from 'stream';

beforeEach(() => {
    jest.spyOn(fs, 'createWriteStream').mockImplementation(() => {
        return new BufferWritableMock() as Writable as WriteStream;
    });
});

describe('Pull file tests', () => {
    test('OKAY', async () => {
        const buff = Buffer.from([4, 0, 0, 0]);
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            {
                cmd: 'sync:',
                res: 'DATA' + buff.toString() + 'dataDONE' + buff.toString(),
                rawRes: true
            }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new AdbClient({ noAutoStart: true, port });
            const result = await adb.pullFile('serial', '/file', '/file');
            expect(result).toBeUndefined();
        } finally {
            await adbMock.end();
        }
    });

    test('FAIL', async () => {
        const buff = Buffer.from([4, 0, 0, 0]);
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            {
                cmd: 'sync:',
                res: 'FAIL' + buff.toString() + 'data',
                rawRes: true
            }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new AdbClient({ noAutoStart: true, port });
            try {
                await adb.pullFile('serial', '/file', '/file');
                fail('Expected failure');
            } catch (e) {
                expect(e).toEqual(new FailError('data'));
            }
        } finally {
            await adbMock.end();
        }
    });

    test('Unexpected error', async () => {
        const buff = Buffer.from([4, 0, 0, 0]);
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            {
                cmd: 'sync:',
                res: 'UNEX' + buff.toString() + 'data',
                rawRes: true
            }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new AdbClient({ noAutoStart: true, port });
            try {
                await adb.pullFile('serial', '/file', '/file');
                fail('Expected failure');
            } catch (e) {
                expect(e).toEqual(
                    new UnexpectedDataError('UNEX', 'DATA, DONE or FAIL')
                );
            }
        } finally {
            await adbMock.end();
        }
    });
});
