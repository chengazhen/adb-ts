import { AdbMock } from '../../mockery/mockAdbServer';
import AdbClient from '../../lib/client';
import { FailError, UnexpectedDataError } from '../../lib';
import { Readable } from 'stream';
import fs from 'fs';

beforeAll(() => {
    jest.spyOn(fs, 'createReadStream').mockImplementation(() => {
        return Readable.from([]) as fs.ReadStream;
    });
});

describe('Push data to file', () => {
    test('Success with string data', async () => {
        const buff = Buffer.from([0, 0, 0, 4]);
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            {
                cmd: 'sync:',
                res: 'OKAY' + buff.toString(),
                rawRes: true
            }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new AdbClient({ noAutoStart: true, port });
            const result = await adb.pushFile('serial', 'data', 'dest');
            expect(result).toBeUndefined();
        } finally {
            await adbMock.end();
        }
    });

    test('FAIL', async () => {
        const buff = Buffer.from([5, 0, 0, 0]);
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            {
                cmd: 'sync:',
                res: 'FAIL' + buff.toString() + 'Error',
                rawRes: true
            }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new AdbClient({ noAutoStart: true, port });
            try {
                await adb.pushDataToFile(
                    'serial',
                    Readable.from('data'),
                    'dest'
                );
                fail('Expected failure');
            } catch (e) {
                expect(e).toEqual(new FailError('Error'));
            }
        } finally {
            await adbMock.end();
        }
    });

    test('Unexpected error', async () => {
        const buff = Buffer.from([5, 0, 0, 0]);
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            {
                cmd: 'sync:',
                res: 'UNEX' + buff.toString() + 'Error',
                rawRes: true
            }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new AdbClient({ noAutoStart: true, port });
            try {
                await adb.pushDataToFile(
                    'serial',
                    Readable.from('data'),
                    'dest'
                );
                fail('Expected failure');
            } catch (e) {
                expect(e).toEqual(
                    new UnexpectedDataError('UNEX', 'OKAY or FAIL')
                );
            }
        } finally {
            await adbMock.end();
        }
    });
});
