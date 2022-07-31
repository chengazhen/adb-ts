import AdbMock from '../../mockery/mockAdbServer';
import AdbClient from '../../lib/client';
import { UnexpectedDataError } from '../../lib';

describe('Drag and drop', () => {
    it('OKAY', async () => {
        const adbMock = new AdbMock([
            {
                cmd: 'host:transport:serial',
                res: null,
                rawRes: true
            },
            {
                cmd: `shell:input touchscreen draganddrop 100 200 100 10`,
                res: null,
                rawRes: true
            }
        ]);
        try {
            const port = await adbMock.start();
            const adb = new AdbClient({ noAutoStart: true, port });
            const result = await adb.dragAndDrop('serial', 100, 200, 100, 10);
            expect(result).toBe(void 0);
        } finally {
            await adbMock.end();
        }
    });

    // it('OKAY with source parameter', async () => {
    //     const adbMock = new AdbMock([
    //         {
    //             cmd: 'host:transport:serial',
    //             res: null,
    //             rawRes: true
    //         },
    //         {
    //             cmd: `shell:input gamepad draganddrop 100 200 100 10`,
    //             res: null,
    //             rawRes: true
    //         }
    //     ]);
    //     try {
    //         const port = await adbMock.start();
    //         const adb = new AdbClient({ noAutoStart: true, port });
    //         const result = await adb.dragAndDrop('serial', 100, 200, 100, 10, {
    //             source: 'gamepad'
    //         });
    //         expect(result).toBe(void 0);
    //     } finally {
    //         await adbMock.end();
    //     }
    // });

    // it('OKAY with source parameter undefined', async () => {
    //     const adbMock = new AdbMock([
    //         {
    //             cmd: 'host:transport:serial',
    //             res: null,
    //             rawRes: true
    //         },
    //         {
    //             cmd: `shell:input touchscreen draganddrop 100 200 100 10`,
    //             res: null,
    //             rawRes: true
    //         }
    //     ]);
    //     try {
    //         const port = await adbMock.start();
    //         const adb = new AdbClient({ noAutoStart: true, port });
    //         const result = await adb.dragAndDrop('serial', 100, 200, 100, 10, {
    //             source: undefined
    //         });
    //         expect(result).toBe(void 0);
    //     } finally {
    //         await adbMock.end();
    //     }
    // });

    // it('OKAY with duration parameter undefined', async () => {
    //     const adbMock = new AdbMock([
    //         {
    //             cmd: 'host:transport:serial',
    //             res: null,
    //             rawRes: true
    //         },
    //         {
    //             cmd: `shell:input touchscreen draganddrop 100 200 100 10`,
    //             res: null,
    //             rawRes: true
    //         }
    //     ]);
    //     try {
    //         const port = await adbMock.start();
    //         const adb = new AdbClient({ noAutoStart: true, port });
    //         const result = await adb.dragAndDrop('serial', 100, 200, 100, 10, {
    //             duration: undefined
    //         });
    //         expect(result).toBe(void 0);
    //     } finally {
    //         await adbMock.end();
    //     }
    // });

    // it('OKAY with source and duration parameters', async () => {
    //     const adbMock = new AdbMock([
    //         {
    //             cmd: 'host:transport:serial',
    //             res: null,
    //             rawRes: true
    //         },
    //         {
    //             cmd: `shell:input gamepad draganddrop 100 200 100 10 3000`,
    //             res: null,
    //             rawRes: true
    //         }
    //     ]);
    //     try {
    //         const port = await adbMock.start();
    //         const adb = new AdbClient({ noAutoStart: true, port });
    //         const result = await adb.dragAndDrop('serial', 100, 200, 100, 10, {
    //             source: 'gamepad',
    //             duration: 3000
    //         });
    //         expect(result).toBe(void 0);
    //     } finally {
    //         await adbMock.end();
    //     }
    // });

    // it('FAIL first response', async () => {
    //     const adbMock = new AdbMock([
    //         {
    //             cmd: 'fail',
    //             res: null,
    //             rawRes: true
    //         },
    //         {
    //             cmd: `shell:input touchscreen draganddrop 100 200 100 10`,
    //             res: null,
    //             rawRes: true
    //         }
    //     ]);
    //     try {
    //         const port = await adbMock.start();
    //         const adb = new AdbClient({ noAutoStart: true, port });
    //         try {
    //             await adb.dragAndDrop('serial', 100, 200, 100, 10);
    //             fail('Expected Failure');
    //         } catch (e) {
    //             expect(e).toEqual(new Error('Failure'));
    //         }
    //     } finally {
    //         await adbMock.end();
    //     }
    // });

    // it('FAIL second response', async () => {
    //     const adbMock = new AdbMock([
    //         {
    //             cmd: 'host:transport:serial',
    //             res: null,
    //             rawRes: true
    //         },
    //         {
    //             cmd: 'fail',
    //             res: null,
    //             rawRes: true
    //         }
    //     ]);
    //     try {
    //         const port = await adbMock.start();
    //         const adb = new AdbClient({ noAutoStart: true, port });
    //         try {
    //             await adb.dragAndDrop('serial', 100, 200, 100, 10);
    //             fail('Expected Failure');
    //         } catch (e) {
    //             expect(e).toEqual(new Error('Failure'));
    //         }
    //     } finally {
    //         await adbMock.end();
    //     }
    // });

    // it('Unexpected first response', async () => {
    //     const adbMock = new AdbMock([
    //         {
    //             cmd: 'host:transport:serial',
    //             res: null,
    //             rawRes: true,
    //             unexpected: true
    //         },
    //         {
    //             cmd: `shell:input touchscreen draganddrop 100 200 100 10`,
    //             res: null,
    //             rawRes: true
    //         }
    //     ]);
    //     try {
    //         const port = await adbMock.start();
    //         const adb = new AdbClient({ noAutoStart: true, port });
    //         try {
    //             await adb.dragAndDrop('serial', 100, 200, 100, 10);
    //             fail('Expected Failure');
    //         } catch (e) {
    //             expect(e).toEqual(
    //                 new UnexpectedDataError('ABCD', 'OKAY or FAIL')
    //             );
    //         }
    //     } finally {
    //         await adbMock.end();
    //     }
    // });

    // it('Unexpected second response', async () => {
    //     const adbMock = new AdbMock([
    //         {
    //             cmd: 'host:transport:serial',
    //             res: null,
    //             rawRes: true
    //         },
    //         {
    //             cmd: `shell:input touchscreen draganddrop 100 200 100 10`,
    //             res: null,
    //             rawRes: true,
    //             unexpected: true
    //         }
    //     ]);
    //     try {
    //         const port = await adbMock.start();
    //         const adb = new AdbClient({ noAutoStart: true, port });
    //         try {
    //             await adb.dragAndDrop('serial', 100, 200, 100, 10);
    //             fail('Expected Failure');
    //         } catch (e) {
    //             expect(e).toEqual(
    //                 new UnexpectedDataError('ABCD', 'OKAY or FAIL')
    //             );
    //         }
    //     } finally {
    //         await adbMock.end();
    //     }
    // });
});
