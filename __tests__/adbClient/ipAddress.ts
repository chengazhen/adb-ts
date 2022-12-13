import { AdbMock } from '../../mockery/mockAdbServer';
import AdbClient from '../../lib/client';

describe('IP address', () => {
    it('Single address', async () => {
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            {
                cmd: "shell:ip route | awk '{ print $9 }'",
                res: '127.0.0.1',
                rawRes: true
            }
        ]);

        try {
            const port = await adbMock.start();
            const adb = new AdbClient({ noAutoStart: true, port });
            const result = await adb.getIpAddress('serial');
            expect(result).toBe('127.0.0.1');
        } finally {
            await adbMock.end();
        }
    });

    it('Multiple addresses', async () => {
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            {
                cmd: "shell:ip route | awk '{ print $9 }'",
                res: '127.0.0.1\n127.0.0.2',
                rawRes: true
            }
        ]);

        try {
            const port = await adbMock.start();
            const adb = new AdbClient({ noAutoStart: true, port });
            const result = await adb.getIpAddress('serial');
            expect(result).toEqual(['127.0.0.1', '127.0.0.2']);
        } finally {
            await adbMock.end();
        }
    });

    it('No address', async () => {
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            {
                cmd: "shell:ip route | awk '{ print $9 }'",
                res: null,
                rawRes: true
            }
        ]);

        try {
            const port = await adbMock.start();
            const adb = new AdbClient({ noAutoStart: true, port });
            const result = await adb.getIpAddress('serial');
            expect(result).toBeNull();
        } finally {
            await adbMock.end();
        }
    });

    it('FAIL first response', async () => {
        const adbMock = new AdbMock([
            { cmd: 'fail', res: null, rawRes: true },
            {
                cmd: "shell:ip route | awk '{ print $9 }'",
                res: '127.0.0.1',
                rawRes: true
            }
        ]);

        try {
            const port = await adbMock.start();
            const adb = new AdbClient({ noAutoStart: true, port });
            try {
                await adb.getIpAddress('serial');
                fail('Expected Failure');
            } catch (e) {
                expect(e.message).toBe('Failure');
            }
        } finally {
            await adbMock.end();
        }
    });

    it('FAIL second response', async () => {
        const adbMock = new AdbMock([
            { cmd: 'host:transport:serial', res: null, rawRes: true },
            {
                cmd: 'fail',
                res: '127.0.0.1',
                rawRes: true
            }
        ]);

        try {
            const port = await adbMock.start();
            const adb = new AdbClient({ noAutoStart: true, port });
            try {
                await adb.getIpAddress('serial');
                fail('Expected Failure');
            } catch (e) {
                expect(e.message).toBe('Failure');
            }
        } finally {
            await adbMock.end();
        }
    });
});
