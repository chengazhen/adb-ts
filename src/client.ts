import {
    AdbClientOptions,
    AdbClientOptionsValues,
    InputDurationOptions,
    CommandConstruct,
    CpOptions,
    Callback,
    ValueCallback,
    ForwardsObject,
    IDevice,
    InputSource,
    InstallOptions,
    KeyEventOptions,
    LogcatOptions,
    MkDirOptions,
    MvOptions,
    ReversesObject,
    RmOptions,
    SettingsMode,
    PrimitiveType,
    StartActivityOptions,
    StartServiceOptions,
    TouchOptions,
    UninstallOptions,
    WaitForState,
    IpConnectConstruct,
    PropertyMap,
    NonEmptyArray,
    WaitForType,
    PropertyValue,
    TransportCommandConstruct,
    buildInputParams,
    KeyCode,
    parsePrimitiveParam,
    parseCbParam,
    parseValueParam,
    nodeify,
    AdbExecError,
    buildFsParams
} from './util';
import { Sync, SyncMode } from './sync';
import { execFile } from 'child_process';
import fs from 'fs';
import { Device } from './device';
import BatteryStatusCommand from './commands/host-transport/batteryStatus';
import ClearCommand from './commands/host-transport/clear';
import Connect from './commands/host/connect';
import { Connection } from './connection';
import CpCommand from './commands/host-transport/fileSystem/cp';
import Disconnect from './commands/host/disconnect';
import FileStatCommand from './commands/host-transport/fileStat';
import { FileStat } from './filestats';
import ForwardCommand from './commands/host-serial/forward';
import GetDevicePathCommand from './commands/host-serial/getdevicepath';
import GetIpAddressCommand from './commands/host-transport/ipaddress';
import GetPropertyCommand from './commands/host-transport/getproperty';
import GetSetting from './commands/host-transport/getsetting';
import HostTransportCommand from './commands/host/transport';
import InstallCommand from './commands/host-transport/install';
import IsInstalledCommand from './commands/host-transport/isinstalled';
import KillCommand from './commands/host/kill';
import ListDevicesCommand from './commands/host/listdevices';
import ListFeaturesCommand from './commands/host-transport/listfeatures';
import ListForwardsCommand from './commands/host-serial/listforwards';
import ListPackagesCommand from './commands/host-transport/listpackages';
import ListPropertiesCommand from './commands/host-transport/listproperties';
import ListReversesCommand from './commands/host-transport/listreverses';
import ListSettingsCommand from './commands/host-transport/listSettings';
import LogcatCommand from './commands/host-transport/logcat';
import { LogcatReader } from './logcat/reader';
import MkDirCommand from './commands/host-transport/fileSystem/mkdir';
import { Monkey } from './monkey/client';
import MonkeyCommand from './commands/host-transport/monkey';
import MvCommand from './commands/host-transport/fileSystem/mv';
import { PullTransfer } from './sync/pulltransfer';
import { PushTransfer } from './sync/pushtransfer';
import PutSetting from './commands/host-transport/putSetting';
import { Readable } from 'stream';
import RebootCommand from './commands/host-transport/reboot';
import RemountCommand from './commands/host-transport/remount';
import ReverseCommand from './commands/host-transport/reverse';
import RmCommand from './commands/host-transport/fileSystem/rm';
import RootCommand from './commands/host-transport/root';
import ScreenShotCommand from './commands/host-transport/screencap';
import SetProp from './commands/host-transport/setProperty';
import ShellCommand from './commands/host-transport/shell';
import DeleteApk from './commands/host-transport/deleteApk';
import ShutdownCommand from './commands/host-transport/shutdown';
import StartActivityCommand from './commands/host-transport/startActivity';
import StartServiceCommand from './commands/host-transport/startservice';
import SyncCommand from './commands/host-transport/sync';
import SyncEntry from './sync/entry';
import TcpCommand from './commands/host-transport/tcp';
import TcpIpCommand from './commands/host-transport/tcpip';
import TouchCommand from './commands/host-transport/fileSystem/touch';
import TrackCommand from './commands/host/trackdevices';
import { Tracker } from './tracker';
import UninstallCommand from './commands/host-transport/uninstall';
import UsbCommand from './commands/host-transport/usb';
import VersionCommand from './commands/host/version';
import WaitBootCompleteCommand from './commands/host-transport/waitBootComplete';
import WaitFor from './commands/host/waitFor';
import { promisify } from 'util';
import T from 'timers/promises';
import Text from './commands/host-transport/input/text';
import Roll from './commands/host-transport/input/roll';
import DragAndDrop from './commands/host-transport/input/dragAndDrop';
import Swipe from './commands/host-transport/input/swipe';
import Press from './commands/host-transport/input/press';
import KeyEvent from './commands/host-transport/input/keyEvent';
import Tap from './commands/host-transport/input/tap';
import EventUnregister from './util/eventUnregister';

const ADB_DEFAULT_PORT = 5555;
const DEFAULT_OPTIONS = {
    port: 5037,
    host: 'localhost',
    bin: 'adb',
    noAutoStart: false
} as const;

export class Client {
    private options: AdbClientOptionsValues;

    /**
     * @param {AdbClientOptions} options see AdbClientOptions for more details
     */
    constructor(options?: AdbClientOptions) {
        this.options = Object.entries(options || {})
            .filter(([, value]) => typeof value !== 'undefined')
            .reduce(
                (def, [key, value]) => ({ ...def, [key]: value }),
                DEFAULT_OPTIONS
            );
    }

    /**
     * Starts adb server if not running.
     */
    public startServer(): Promise<void> {
        const port = this.options.port;
        const args = ['-P', port.toString(), 'start-server'];
        return promisify<void>((cb_) =>
            execFile(this.options.bin, args, (err) => cb_(err))
        )();
    }

    private connection(): Promise<Connection> {
        return new Promise<Connection>((resolve, reject) => {
            let triedStarting = false;
            const connection = new Connection();

            const errorListener = async (
                err: NodeJS.ErrnoException
            ): Promise<void> => {
                if (
                    err.code === 'ECONNREFUSED' &&
                    !triedStarting &&
                    !this.options.noAutoStart
                ) {
                    triedStarting = true;
                    await this.startServer();
                    connection.connect(this.options);
                    return;
                }
                connection.destroy();
                return reject(err);
            };
            connection.on('error', errorListener);
            connection.once('connect', () => {
                connection.off('error', errorListener);
                return resolve(connection);
            });
            connection.connect(this.options);
        });
    }

    public async transport(serial: string): Promise<Connection> {
        const conn = await this.connection();
        await new HostTransportCommand(conn, serial).execute();
        return conn;
    }

    /**
     * Gets the adb server version.
     */
    public async version(): Promise<number> {
        return new VersionCommand(await this.connection()).execute();
    }

    private async ipConnect(
        Construct: IpConnectConstruct,
        host: string,
        port: number | ValueCallback<string> | undefined
    ): Promise<string> {
        let port_ = parseValueParam(port);
        if (host.indexOf(':') !== -1) {
            const [h, p] = host.split(':', 2);
            host = h;
            port_ = parseInt(p);
        }
        const conn = await this.connection();
        return new Construct(
            conn,
            host,
            parsePrimitiveParam(ADB_DEFAULT_PORT, port_)
        ).execute();
    }

    /**
     * Connects to device over local network.
     * @example
     * adb.map(async (device) => {
     *    await device.tcpip();
     *    const [ip] = await device.getIpAddress();
     *    await adb.connect(ip);
     *});
     */
    public connect(host: string): Promise<string>;
    public connect(host: string, port: number): Promise<string>;
    public connect(host: string, port?: number): Promise<string> {
        return this.ipConnect(Connect, host, port);
    }

    /**
     * Disconnects from the given device.
     */
    public disconnect(host: string): Promise<string>;
    public disconnect(host: string, port: number): Promise<string>;
    public disconnect(host: string, port?: number): Promise<string> {
        return this.ipConnect(Disconnect, host, port);
    }

    /**
     * Gets the list of currently connected devices and emulators.
     */
    public async listDevices(): Promise<IDevice[]> {
        return new ListDevicesCommand(await this.connection()).execute();
    }

    /**
     * Tracks connection status of devices.
     */
    public async trackDevices(): Promise<Tracker> {
        const conn = await this.connection();
        const command = new TrackCommand(conn);
        await command.execute();
        return new Tracker(command, this);
    }

    /**
     * Kills the adb server.
     */
    public kill(): Promise<void> {
        // TODO try catch
        return this.connection()
            .catch((error) => {
                if (error.code !== 'ECONNREFUSED') {
                    throw error;
                }
            })
            .then((conn) => conn && new KillCommand(conn).execute());
    }

    /**
     * Gets the serial number of the device.
     * Meant for getting serial number of local devices.
     * Analogous to `adb shell getprop ro.serialno`.
     */
    public async getSerialNo(serial: string): Promise<string> {
        // TODO should trim
        const serialNo = await this.getProp(serial, 'ro.serialno');
        return String(serialNo);
    }

    /**
     * Gets the device path of the device identified by the device.
     */
    public async getDevicePath(serial: string): Promise<string> {
        return new GetDevicePathCommand(
            await this.connection(),
            serial
        ).execute();
    }

    /**
     * Lists properties of the device.
     * Analogous to `adb shell getprop`.
     */
    public async listProperties(serial: string): Promise<PropertyMap> {
        return new ListPropertiesCommand(
            await this.connection(),
            serial
        ).execute();
    }

    /**
     * Lists features of the device.
     * Analogous to `adb shell pm list features`.
     */
    public async listFeatures(serial: string): Promise<PropertyMap> {
        return new ListFeaturesCommand(
            await this.connection(),
            serial
        ).execute();
    }

    /**
     * Lists installed packages.
     * Analogous to `adb shell pm list packages`.
     */
    public async listPackages(serial: string): Promise<string[]> {
        return new ListPackagesCommand(
            await this.connection(),
            serial
        ).execute();
    }

    /**
     * Gets the ipv4 addresses of default wlan interface.
     */
    public async getIpAddress(serial: string): Promise<string[]> {
        return new GetIpAddressCommand(
            await this.connection(),
            serial
        ).execute();
    }

    /**
     * Forwards socket connections from the ADB server host (local) to the device (remote).
     * Analogous to `adb forward <local> <remote>`.
     * @example
     * adb.forward('serial', 'tcp:9222', 'localabstract:chrome_devtools_remote')
     */
    public async forward(
        serial: string,
        local: string,
        remote: string
    ): Promise<void> {
        return new ForwardCommand(
            await this.connection(),
            serial,
            local,
            remote
        ).execute();
    }

    /**
     * Lists all forwarded connections.
     * Analogous to `adb forward --list`.
     */
    public async listForwards(serial: string): Promise<ForwardsObject[]> {
        return new ListForwardsCommand(
            await this.connection(),
            serial
        ).execute();
    }

    /**
     * Reverses socket connections from the device (remote) to the ADB server host (local).
     * Analogous to `adb reverse <remote> <local>`.
     * @example
     * adb.reverse('serial', 'localabstract:chrome_devtools_remote', 'tcp:9222')
     */
    public async reverse(
        serial: string,
        local: string,
        remote: string
    ): Promise<void> {
        return new ReverseCommand(
            await this.connection(),
            serial,
            local,
            remote
        ).execute();
    }

    /**
     * Lists all reversed connections.
     * Analogous to `adb reverse --list`.
     */
    public async listReverses(serial: string): Promise<ReversesObject[]> {
        return new ListReversesCommand(
            await this.connection(),
            serial
        ).execute();
    }

    private deleteApk(serial: string, pathToApk: string): Promise<void> {
        return this.connection().then((conn) => {
            return new DeleteApk(conn, serial, pathToApk).execute();
        });
    }

    /**
     * Reboots the device.
     * Analogous to `adb reboot`.
     */
    public async reboot(serial: string): Promise<void> {
        return new RebootCommand(conn, serial).execute();
    }

    /**
     * Shuts the device down.
     * Analogous to `adb reboot -p`.
     */
    public async shutdown(serial: string): Promise<void> {
        return new ShutdownCommand(conn, serial).execute();
    }

    /**
     * Attempts to remount the `/system` partition in read-write mode.
     * Can be done on a rooted device. Analogous to `adb remount`.
     * Analogous to `adb remount`
     */
    public async remount(serial: string): Promise<void> {
        return new RemountCommand(conn, serial).execute();
    }

    /**
     * Attempts to which the device to the root mode.
     * Analogous to `adb root`.
     */
    public async root(serial: string): Promise<void> {
        return new RootCommand(conn, serial).execute();
    }

    /**
     * Takes a screenshot on the specified device.
     * Analogous to `adb shell screencap -p`.
     */
    public async screenshot(serial: string): Promise<Buffer> {
        return new ScreenShotCommand(conn, serial).execute();
    }

    /**
     * Opens a direct TCP connection to specified port on the device.
     * Analogous to `adb tcp <port>:<host>`.
     * @example
     * const socket = await adb.openTcp('serial', 5555);
     * // socket.write(...)
     */
    public async openTcp(serial: string, port: number): Promise<Connection>;
    public async openTcp(
        serial: string,
        port: number,
        host: string
    ): Promise<Connection>;
    public async openTcp(
        serial: string,
        port: number,
        host?: string
    ): Promise<Connection> {
        return new TcpCommand(
            conn,
            serial,
            port,
            parseValueParam(host)
        ).execute();
    }

    /**
     * Sends roll input command to the device shell.
     * Analogous to `adb shell input trackball roll <x> <y>`.
     * Default input source is `trackball`.
     * @param x Horizontal coordinate.
     * @param y Vertical coordinate.
     */
    public async roll(serial: string, x: number, y: number): Promise<void>;
    public async roll(
        serial: string,
        x: number,
        y: number,
        source: InputSource
    ): Promise<void>;
    public async roll(
        serial: string,
        x: number,
        y: number,
        source?: InputSource
    ): Promise<void> {
        const { params } = buildInputParams(source, undefined);
        return new Roll(conn, serial, {
            source: params,
            x,
            y
        }).execute();
    }

    /**
     * Sends roll input command to the device shell.
     * Analogous to `adb shell input trackball press`.
     * Default input source is `trackball`.
     */
    public async press(serial: string): Promise<void>;
    public async press(serial: string, source: InputSource): Promise<void>;
    public async press(serial: string, source?: InputSource): Promise<void> {
        const { params } = buildInputParams(source, undefined);
        return new Press(conn, serial, params).execute();
    }

    /**
     * Sends draganddrop input command to the device shell.
     * Analogous to `adb shell input touchscreen draganddrop x1 y1 x2 y2`.
     * Default input source is `touchscreen`.
     * @param x1 Horizontal starting coordinate.
     * @param y1 Vertical starting coordinate.
     * @param x2 Horizontal ending coordinate.
     * @param y2 Vertical ending coordinate.
     */
    public async dragAndDrop(
        serial: string,
        x1: number,
        y1: number,
        x2: number,
        y2: number
    ): Promise<void>;
    public async dragAndDrop(
        serial: string,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        options: InputDurationOptions
    ): Promise<void>;
    public async dragAndDrop(
        serial: string,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        options?: InputDurationOptions
    ): Promise<void> {
        const { params } = buildInputParams(options, undefined);
        return new DragAndDrop(conn, serial, {
            x1,
            y1,
            x2,
            y2,
            options: params
        }).execute();
    }

    /**
     * Sends swipe input command to the device shell.
     * Analogous to `adb shell input touchscreen swipe x1 y1 x2 y2`.
     * Default input source is `touchscreen`.
     * @param x1 Horizontal starting coordinate.
     * @param y1 Vertical starting coordinate.
     * @param x2 Horizontal ending coordinate.
     * @param y2 Vertical ending coordinate.
     */
    public async swipe(
        serial: string,
        x1: number,
        y1: number,
        x2: number,
        y2: number
    ): Promise<void>;
    public async swipe(
        serial: string,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        options: InputDurationOptions
    ): Promise<void>;
    public async swipe(
        serial: string,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        options?: InputDurationOptions
    ): Promise<void> {
        const { params } = buildInputParams(options, undefined);
        return new Swipe(conn, serial, {
            x1,
            y1,
            x2,
            y2,
            options: params
        }).execute();
    }

    /**
     * Sends keyevent input command to the device shell.
     * Analogous to `adb shell input keyboard keyevent <code>`.
     * Default input source is `keyboard`.
     * @param code Key code to send.
     */
    keyEvent(
        serial: string,
        code: KeyCode | NonEmptyArray<KeyCode>
    ): Promise<void>;
    keyEvent(
        serial: string,
        code: number | NonEmptyArray<number>
    ): Promise<void>;

    keyEvent(
        serial: string,
        code: KeyCode | NonEmptyArray<KeyCode>,
        options: KeyEventOptions
    ): Promise<void>;
    keyEvent(
        serial: string,
        code: number | NonEmptyArray<number>,
        options: KeyEventOptions
    ): Promise<void>;

    keyEvent(
        serial: string,
        code: KeyCode | NonEmptyArray<KeyCode>,
        cb: Callback
    ): void;
    keyEvent(
        serial: string,
        code: number | NonEmptyArray<number>,
        cb: Callback
    ): void;

    keyEvent(
        serial: string,
        code: KeyCode | NonEmptyArray<KeyCode>,
        options: KeyEventOptions,
        cb: Callback
    ): void;
    keyEvent(
        serial: string,
        code: number | NonEmptyArray<number>,
        options: KeyEventOptions,
        cb: Callback
    ): void;

    keyEvent(
        serial: string,
        code: number | NonEmptyArray<number>,
        options?: KeyEventOptions | Callback,
        cb?: Callback
    ): Promise<void> | void {
        const { params, cb_ } = buildInputParams(options, cb);
        return nodeify(
            this.connection().then((conn) => {
                return new KeyEvent(conn, serial, {
                    options: params,
                    code
                }).execute();
            }),
            cb_
        );
    }

    /**
     * Sends tap input command to the device shell.
     * Analogous to `adb shell input touchscreen tap <x> <y>`.
     * Default input source is `touchscreen`.
     * @param x Horizontal coordinate.
     * @param y Vertical coordinate.
     */
    tap(serial: string, x: number, y: number): Promise<void>;
    tap(
        serial: string,
        x: number,
        y: number,
        source: InputSource
    ): Promise<void>;
    tap(serial: string, x: number, y: number, cb: Callback): void;
    tap(
        serial: string,
        x: number,
        y: number,
        source: InputSource,
        cb: Callback
    ): void;
    tap(
        serial: string,
        x: number,
        y: number,
        source?: InputSource | Callback,
        cb?: Callback
    ): Promise<void> | void {
        const { params, cb_ } = buildInputParams(source, cb);

        return nodeify(
            this.connection().then((conn) => {
                return new Tap(conn, serial, {
                    source: params,
                    x,
                    y
                }).execute();
            }),
            cb_
        );
    }

    /**
     * Sends text input command to the device shell.
     * Analogous to `adb shell input touchscreen text '<text>'`.
     * Default input source is `touchscreen`.
     */
    text(serial: string, text: string): Promise<void>;
    text(serial: string, text: string, source: InputSource): Promise<void>;
    text(serial: string, text: string, cb: Callback): void;
    text(serial: string, text: string, source: InputSource, cb: Callback): void;
    text(
        serial: string,
        text: string,
        source?: InputSource | Callback,
        cb?: Callback
    ): Promise<void> | void {
        const { params, cb_ } = buildInputParams(source, cb);
        return nodeify(
            this.connection().then((conn) => {
                return new Text(conn, serial, {
                    source: params,
                    text
                }).execute();
            }),
            cb_
        );
    }

    /**
     * Opens logcat.
     * Analogous to `adb logcat`.
     * @see `LogcatReader` and `LogcatOptions` for more details.
     * @example
     * import { Client, Priority } from 'adb-ts';
     * const adb = new Client();
     * const logcat = await adb.openLogcat('serial', {
     *     filter: (entry) => entry.priority > Priority.INFO
     * });
     * logcat.on('entry', (entry) => {
     *     console.log(entry);
     * });
     */
    openLogcat(serial: string): Promise<LogcatReader>;
    openLogcat(serial: string, options: LogcatOptions): Promise<LogcatReader>;
    openLogcat(serial: string, cb: ValueCallback<LogcatReader>): void;
    openLogcat(
        serial: string,
        options: LogcatOptions,
        cb: ValueCallback<LogcatReader>
    ): void;
    openLogcat(
        serial: string,
        options?: ValueCallback<LogcatReader> | LogcatOptions,
        cb?: ValueCallback<LogcatReader>
    ): Promise<LogcatReader> | void {
        if (typeof options === 'function') {
            cb = options;
            options = undefined;
        }

        return nodeify(
            this.connection().then((conn) => {
                return new LogcatCommand(
                    conn,
                    serial,
                    typeof options === 'object' ? options : undefined
                ).execute();
            }),
            cb
        );
    }

    private syncService(serial: string): Promise<Sync> {
        return this.connection().then((conn) => {
            return new SyncCommand(conn, serial).execute();
        });
    }

    /**
     * Deletes all data associated with a package from the device.
     * Analogous to `adb shell pm clear <pkg>`.
     */
    clear(serial: string, pkg: string): Promise<void>;
    clear(serial: string, pkg: string, cb: Callback): void;
    clear(serial: string, pkg: string, cb?: Callback): Promise<void> | void {
        return nodeify(
            this.connection().then((conn) => {
                return new ClearCommand(conn, serial, pkg).execute();
            }),
            cb
        );
    }

    private installRemote(
        serial: string,
        apk: string,
        options?: InstallOptions,
        args?: string
    ): Promise<void> {
        return this.connection().then((conn) => {
            return new InstallCommand(conn, serial, apk, options, args)
                .execute()
                .then(() => this.deleteApk(serial, apk));
        });
    }

    /**
     * Installs an apk to the device.
     * Analogous to `adb install <pkg>`.
     */
    install(serial: string, apk: string | Readable): Promise<void>;
    install(
        serial: string,
        apk: string | Readable,
        options: InstallOptions
    ): Promise<void>;
    /**
     * @param args Extra arguments. E.g. `--fastdeploy` flag.
     */
    install(
        serial: string,
        apk: string | Readable,
        options: InstallOptions,
        args: string
    ): Promise<void>;
    install(serial: string, apk: string | Readable, cb: Callback): void;
    install(
        serial: string,
        apk: string | Readable,
        options: InstallOptions,
        cb: Callback
    ): void;
    install(
        serial: string,
        apk: string | Readable,
        options: InstallOptions,
        args: string,
        cb: Callback
    ): void;

    install(
        serial: string,
        apk: string | Readable,
        options?: InstallOptions | Callback,
        args?: string | Callback,
        cb?: Callback
    ): Promise<void> | void {
        const temp = Sync.temp(typeof apk === 'string' ? apk : '_stream.apk');
        return nodeify(
            this.push(serial, apk, temp).then((transfer) => {
                const eventUnregister = new EventUnregister(transfer);
                const promise = new Promise<void>((resolve, reject) => {
                    eventUnregister.register((transfer) =>
                        transfer.on('error', reject).on('end', (): void => {
                            this.installRemote(
                                serial,
                                temp,
                                parseValueParam(options),
                                parseValueParam(args)
                            )
                                .then(resolve)
                                .catch(reject);
                        })
                    );
                });
                return eventUnregister.unregisterAfter(promise);
            }),
            parseCbParam(options, cb) || parseCbParam(args, cb)
        );
    }

    /**
     * Uninstalls a package from the device.
     * Analogous to `adb uninstall`.
     */
    uninstall(serial: string, pkg: string): Promise<void>;
    uninstall(
        serial: string,
        pkg: string,
        options: UninstallOptions
    ): Promise<void>;
    uninstall(serial: string, pkg: string, cb: Callback): void;
    uninstall(
        serial: string,
        pkg: string,
        options: UninstallOptions,
        cb: Callback
    ): void;
    uninstall(
        serial: string,
        pkg: string,
        options?: Callback | UninstallOptions,
        cb?: Callback
    ): Promise<void> | void {
        return nodeify(
            this.connection().then((conn) => {
                return new UninstallCommand(
                    conn,
                    serial,
                    pkg,
                    parseValueParam(options)
                ).execute();
            }),
            parseCbParam(options, cb)
        );
    }

    /**
     * Tells if a package is installed or not.
     */
    isInstalled(serial: string, pkg: string): Promise<boolean>;
    isInstalled(serial: string, pkg: string, cb: ValueCallback<boolean>): void;
    isInstalled(
        serial: string,
        pkg: string,
        cb?: ValueCallback<boolean>
    ): Promise<boolean> | void {
        return nodeify(
            this.connection().then((conn) => {
                return new IsInstalledCommand(conn, serial, pkg).execute();
            }),
            cb
        );
    }

    /**
     * Starts a new activity with options.
     * Analogous to `adb shell am start <pkg./activity>`.
     */
    startActivity(serial: string, pkg: string, activity: string): Promise<void>;
    startActivity(
        serial: string,
        pkg: string,
        activity: string,
        options: StartActivityOptions
    ): Promise<void>;
    startActivity(
        serial: string,
        pkg: string,
        activity: string,
        cb: Callback
    ): void;
    startActivity(
        serial: string,
        pkg: string,
        activity: string,
        options: StartActivityOptions,
        cb: Callback
    ): void;
    startActivity(
        serial: string,
        pkg: string,
        activity: string,
        options?: StartActivityOptions | Callback,
        cb?: Callback
    ): Promise<void> | void {
        return nodeify(
            this.connection().then((conn) => {
                return new StartActivityCommand(
                    conn,
                    serial,
                    pkg,
                    activity,
                    parseValueParam(options)
                ).execute();
            }),
            parseCbParam(options, cb)
        );
    }

    /**
     * Starts a new service with options.
     * Analogous to `adb shell am startservice <pkg> <service>`.
     */
    startService(serial: string, pkg: string, service: string): Promise<void>;
    startService(
        serial: string,
        pkg: string,
        service: string,
        options: StartServiceOptions
    ): Promise<void>;
    startService(
        serial: string,
        pkg: string,
        service: string,
        cb: Callback
    ): void;
    startService(
        serial: string,
        pkg: string,
        service: string,
        options: StartServiceOptions,
        cb: Callback
    ): void;
    startService(
        serial: string,
        pkg: string,
        service: string,
        options?: StartServiceOptions | Callback,
        cb?: Callback
    ): Promise<void> | void {
        return nodeify(
            this.connection().then((conn) => {
                return new StartServiceCommand(
                    conn,
                    serial,
                    pkg,
                    service,
                    parseValueParam(options)
                ).execute();
            }),
            parseCbParam(options, cb)
        );
    }

    /**
     * Reads given directory.
     * The path should start with `/`.
     */
    readDir(serial: string, path: string): Promise<SyncEntry[]>;
    readDir(serial: string, path: string, cb: ValueCallback<SyncEntry[]>): void;
    readDir(
        serial: string,
        path: string,
        cb?: ValueCallback<SyncEntry[]>
    ): Promise<SyncEntry[]> | void {
        return nodeify(
            this.syncService(serial).then((sync) => {
                return sync.readDir(path).finally(() => {
                    return sync.end();
                });
            }),
            cb
        );
    }

    /**
     * Gets a PullTransfer instance.
     * @see `PullTransfer`
     * @example
     * let data = '';
     * const transfer = await adb.pull('serial', '/path')
     * transfer.on('data', (chunk) => {
     *     data += chunk.toString();
     * });
     * transfer.on('end', () => {
     *     console.log(data);
     * });
     */
    pull(serial: string, path: string): Promise<PullTransfer>;
    pull(serial: string, path: string, cb: ValueCallback<PullTransfer>): void;

    pull(
        serial: string,
        path: string,
        cb?: ValueCallback<PullTransfer>
    ): Promise<PullTransfer> | void {
        return nodeify(
            this.syncService(serial).then((sync) => {
                return sync.pull(path).on('end', () => {
                    sync.end();
                });
            }),
            cb
        );
    }

    /**
     * Gets a PushTransfer instance.
     * @see `PushTransfer`
     * @example
     * const transfer = await adb.push('serial', '/path-src', '/path-dest')
     * transfer.on('end', () => { });
     */
    push(
        serial: string,
        srcPath: string | Readable,
        destPath: string
    ): Promise<PushTransfer>;
    push(
        serial: string,
        srcPath: string | Readable,
        destPath: string,
        mode: SyncMode
    ): Promise<PushTransfer>;
    push(
        serial: string,
        srcPath: string | Readable,
        destPath: string,
        cb: ValueCallback<PushTransfer>
    ): void;
    push(
        serial: string,
        srcPath: string | Readable,
        destPath: string,
        mode: SyncMode,
        cb: ValueCallback<PushTransfer>
    ): void;
    push(
        serial: string,
        srcPath: string | Readable,
        destPath: string,
        mode?: ValueCallback<PushTransfer> | SyncMode,
        cb?: ValueCallback<PushTransfer>
    ): Promise<PushTransfer> | void {
        return nodeify(
            this.syncService(serial).then((sync) => {
                return sync
                    .push(srcPath, destPath, parseValueParam(mode))
                    .on('end', () => {
                        sync.end();
                    });
            }),
            parseCbParam(mode, cb)
        );
    }

    private async awaitActiveDevice(serial: string): Promise<void> {
        const track = (tracker: Tracker): Promise<void> => {
            return new Promise<void>((resolve, reject) => {
                const activeDeviceListener = (device: IDevice): void => {
                    if (
                        device.id === serial &&
                        (device.state === 'device' ||
                            device.state === 'emulator')
                    ) {
                        resolve();
                    }
                };
                tracker.once('error', reject);
                tracker.once('remove', (device) => {
                    if (device.id === serial) {
                        tracker.on('add', activeDeviceListener);
                        tracker.on('change', activeDeviceListener);
                    }
                });
            });
        };
        const tracker_2 = await this.trackDevices();
        try {
            return await Promise.race([
                T.setTimeout(5000, undefined, { ref: false }),
                track(tracker_2)
            ]);
        } finally {
            tracker_2.end();
        }
    }

    /**
     * Puts the device ADB daemon into tcp mode.
     * Afterwards it is possible to use `connect` method.
     * Analogous to `adb tcpip 5555`.
     */
    tcpip(serial: string): Promise<void>;
    tcpip(serial: string, port: number): Promise<void>;
    tcpip(serial: string, cb: Callback): void;
    tcpip(serial: string, port: number, cb: Callback): void;
    tcpip(
        serial: string,
        port?: Callback | number,
        cb?: Callback
    ): Promise<void> | void {
        return nodeify(
            this.connection().then((conn) => {
                return new TcpIpCommand(
                    conn,
                    serial,
                    this.awaitActiveDevice(serial),
                    parsePrimitiveParam(ADB_DEFAULT_PORT, parseValueParam(port))
                ).execute();
            }),
            parseCbParam(port, cb)
        );
    }

    /**
     * Sets the device transport back to usb.
     */
    usb(serial: string): Promise<void>;
    usb(serial: string, cb: Callback): void;
    usb(serial: string, cb?: Callback): Promise<void> | void {
        return nodeify(
            this.connection().then((conn) => {
                return new UsbCommand(
                    conn,
                    serial,
                    this.awaitActiveDevice(serial)
                ).execute();
            }),
            cb
        );
    }

    /**
     * Waits until the device has finished booting.
     */
    waitBootComplete(serial: string): Promise<void>;
    waitBootComplete(serial: string, cb: Callback): void;
    waitBootComplete(serial: string, cb?: Callback): Promise<void> | void {
        return nodeify(
            this.connection().then((conn) => {
                return new WaitBootCompleteCommand(conn, serial).execute();
            }),
            cb
        );
    }

    /**
     * Waits until the device is in the given state.
     * Analogous to `adb wait-for-<transport>-<state>`.
     */
    waitFor(transport: WaitForType, state: WaitForState): Promise<void>;
    waitFor(transport: WaitForType, state: WaitForState, cb?: Callback): void;
    waitFor(
        transport: WaitForType,
        state: WaitForState,
        cb?: Callback
    ): Promise<void> | void {
        return nodeify(
            this.connection().then((conn) => {
                return new WaitFor(conn, transport, state).execute();
            }),
            cb
        );
    }

    /**
     * Maps through all connected devices.
     */
    async map<T>(mapper: (device: Device) => Promise<T> | T): Promise<T[]> {
        const devices = await this.listDevices();
        return Promise.all(
            devices.map((device_1) => mapper(new Device(this, device_1)))
        );
    }

    private async pushInternal(
        serial: string,
        data: string | Readable,
        dest: string
    ): Promise<void> {
        const transfer = await this.push(serial, data, `${dest}`);
        return new Promise((resolve, reject) => {
            transfer.once('end', resolve);
            transfer.once('error', reject);
        });
    }

    /**
     * Wraps {@link push} method, provides API for quick data writing.
     */
    pushDataToFile(
        serial: string,
        data: string | Buffer | Readable,
        destPath: string
    ): Promise<void>;
    pushDataToFile(
        serial: string,
        data: string | Buffer | Readable,
        destPath: string,
        cb: Callback
    ): void;
    pushDataToFile(
        serial: string,
        data: string | Buffer | Readable,
        destPath: string,
        cb?: Callback
    ): Promise<void> | void {
        return nodeify(
            this.pushInternal(
                serial,
                Readable.from(
                    typeof data === 'string' ? Buffer.from(data, 'utf-8') : data
                ),
                destPath
            ),
            cb
        );
    }

    /**
     * Wraps {@link push} method, reads the content of file on the host to a file on the device.
     */
    pushFile(serial: string, srcPath: string, destPath: string): Promise<void>;
    pushFile(
        serial: string,
        srcPath: string,
        destPath: string,
        cb: Callback
    ): void;
    pushFile(
        serial: string,
        srcPath: string,
        destPath: string,
        cb?: Callback
    ): Promise<void> | void {
        return nodeify(this.pushInternal(serial, srcPath, destPath), cb);
    }

    /**
     * Wraps {@link pull} method, reads the file content and resolves with the output.
     */
    pullDataFromFile(serial: string, srcPath: string): Promise<Buffer>;
    pullDataFromFile(
        serial: string,
        srcPath: string,
        cb: ValueCallback<Buffer>
    ): void;
    pullDataFromFile(
        serial: string,
        srcPath: string,
        cb?: ValueCallback<Buffer>
    ): Promise<Buffer> | void {
        return nodeify(
            this.pull(serial, `${srcPath}`).then(
                (transfer: PullTransfer): Promise<Buffer> => {
                    return new Promise((resolve, reject) => {
                        let data = Buffer.alloc(0);
                        transfer.on('data', (chunk) => {
                            data = Buffer.isBuffer(chunk)
                                ? Buffer.concat([data, chunk])
                                : data;
                        });
                        transfer.on('end', () => {
                            resolve(data);
                        });
                        transfer.on('error', reject);
                    });
                }
            ),
            cb
        );
    }

    /**
     * Wraps {@link pull} method, reads the content of file on the device and write it to a file on the machine.
     */
    pullFile(serial: string, srcPath: string, destPath: string): Promise<void>;
    pullFile(
        serial: string,
        srcPath: string,
        destPath: string,
        cb: Callback
    ): void;
    pullFile(
        serial: string,
        srcPath: string,
        destPath: string,
        cb?: Callback
    ): Promise<void> | void {
        return nodeify(
            this.pull(serial, srcPath).then(
                async (transfer: PullTransfer): Promise<void> => {
                    const eventUnregister = new EventUnregister(transfer);
                    const promise = new Promise<void>((resolve, reject) => {
                        eventUnregister.register((transfer_) =>
                            transfer_
                                .once('readable', () =>
                                    transfer_.pipe(
                                        fs.createWriteStream(destPath)
                                    )
                                )
                                .once('end', resolve)
                                .once('error', reject)
                        );
                    });

                    return eventUnregister.unregisterAfter(promise);
                }
            ),
            cb
        );
    }

    /**
     * Sets property on the device.
     * Analogues to `adb shell setprop <prop> <value>`.
     */
    setProp(serial: string, prop: string, value: PrimitiveType): Promise<void>;
    setProp(
        serial: string,
        prop: string,
        value: PrimitiveType,
        cb?: Callback
    ): void;
    setProp(
        serial: string,
        prop: string,
        value: PrimitiveType,
        cb?: Callback
    ): Promise<void> | void {
        return nodeify(
            this.connection().then((conn) =>
                new SetProp(conn, serial, prop, value).execute()
            ),
            cb
        );
    }

    /**
     * Gets property from the device.
     * Analogues to `adb shell getprop <prop>`.
     */
    getProp(serial: string, prop: string): Promise<PropertyValue>;
    getProp(
        serial: string,
        prop: string,
        cb: ValueCallback<PropertyValue>
    ): void;
    getProp(
        serial: string,
        prop: string,
        cb?: ValueCallback<PropertyValue>
    ): Promise<PropertyValue> | void {
        return nodeify(
            this.connection().then((conn) => {
                return new GetPropertyCommand(conn, serial, prop).execute();
            }),
            cb
        );
    }

    /**
     * Puts setting on the device.
     * Analogues to `adb shell settings put <mode> <name> <value>`.
     */
    putSetting(
        serial: string,
        mode: SettingsMode,
        name: string,
        value: PrimitiveType
    ): Promise<void>;
    putSetting(
        serial: string,
        mode: SettingsMode,
        name: string,
        value: PrimitiveType,
        cb: Callback
    ): void;
    putSetting(
        serial: string,
        mode: SettingsMode,
        name: string,
        value: PrimitiveType,
        cb?: Callback
    ): Promise<void> | void {
        return nodeify(
            this.connection().then((conn) => {
                return new PutSetting(
                    conn,
                    serial,
                    mode,
                    name,
                    value
                ).execute();
            }),
            cb
        );
    }

    /**
     * Lists settings of the device.
     * Analogues to `adb shell settings list <mode>`.
     */
    listSettings(serial: string, mode: SettingsMode): Promise<PropertyMap>;
    listSettings(
        serial: string,
        mode: SettingsMode,
        cb: ValueCallback<PropertyMap>
    ): void;
    listSettings(
        serial: string,
        mode: SettingsMode,
        cb?: ValueCallback<PropertyMap>
    ): Promise<PropertyMap> | void {
        return nodeify(
            this.connection().then((conn) => {
                return new ListSettingsCommand(conn, serial, mode).execute();
            }),
            cb
        );
    }

    /**
     * Gets setting from the device.
     * Analogues to `adb shell settings get <mode> <name>`.
     */
    getSetting(
        serial: string,
        mode: SettingsMode,
        name: string
    ): Promise<PropertyValue>;
    getSetting(
        serial: string,
        mode: SettingsMode,
        name: string,
        cb: ValueCallback<PropertyValue>
    ): void;
    getSetting(
        serial: string,
        mode: SettingsMode,
        name: string,
        cb?: ValueCallback<PropertyValue>
    ): Promise<PropertyValue> | void {
        return nodeify(
            this.connection().then((conn) => {
                return new GetSetting(conn, serial, mode, name).execute();
            }),
            cb
        );
    }

    /**
     * Executes a given shell command via adb console interface. Analogous to `adb -s <serial> shell <command>`.
     */
    shell(serial: string, command: string): Promise<string>;
    shell(serial: string, command: string, cb: ValueCallback<string>): void;
    shell(
        serial: string,
        command: string,
        cb?: ValueCallback<string>
    ): Promise<string> | void {
        return nodeify(
            this.connection().then((conn) => {
                return new ShellCommand(conn, serial, command).execute();
            }),
            cb
        );
    }

    /**
     * Enables to execute any custom command.
     * @example
     *   class MyCommand extends Command<number> {
     *   protected autoEnd = true;
     *   private arg: string;
     *   constructor(connection: Connection, arg: string) {
     *       super(connection);
     *       this.arg = arg;
     *   }
     *   async execute(): Promise<number> {
     *       const reply = await this.initExecute(this.arg);
     *       switch (reply) {
     *           case Reply.OKAY:
     *               const value = await this.parser.readValue();
     *               return parseInt(value.toString(), 10);
     *           case Reply.FAIL:
     *               throw await this.parser.readError();
     *           default:
     *               return parseInt(reply, 10);
     *          }
     *      }
     *  }
     */
    async custom<T, P extends unknown[] = unknown[]>(
        CustomCommand: CommandConstruct<T, P>,
        ...args: P
    ): Promise<T> {
        const conn = await this.connection();
        return new CustomCommand(conn, ...args).execute();
    }

    /**
     * Enables to execute any custom transport command.
     * @example
     *    class MyCommand extends TransportCommand<null> {
     *    protected keepAlive = false;
     *    private arg: string;
     *    constructor(connection: Connection, serial: string, arg: string) {
     *        super(connection, serial);
     *        this.arg = arg;
     *    }
     *    protected get Cmd() {
     *        return 'test '.concat(this.arg);
     *    }
     *    protected postExecute(): null {
     *        return null;
     *    }
     * }
     */
    customTransport<T, P extends unknown[] = unknown[]>(
        CustomCommand: TransportCommandConstruct<T, P>,
        serial: string,
        ...args: P
    ): Promise<T> {
        return this.connection().then((conn) => {
            return new CustomCommand(conn, serial, ...args).execute();
        });
    }

    /**
     * Establishes a new monkey connection on port `1080`.
     */
    openMonkey(serial: string): Promise<Monkey>;
    openMonkey(serial: string, cb: ValueCallback<Monkey>): void;
    openMonkey(
        serial: string,
        cb?: ValueCallback<Monkey>
    ): Promise<Monkey> | void {
        const tryConnect = async (times: number): Promise<Monkey> => {
            try {
                const stream = await this.openTcp(serial, 1080);
                return new Monkey().connect(stream);
            } catch (err) {
                if ((times -= 1)) {
                    await T.setTimeout(100);
                    return tryConnect(times);
                }
                throw err;
            }
        };

        const establishConnection = async (
            attempts: number
        ): Promise<Monkey> => {
            const tryConnectHandler = async (
                conn: Connection,
                monkey: Monkey
            ): Promise<Monkey> => {
                await T.setTimeout(100);
                const hookMonkey = async (): Promise<Monkey> => {
                    return monkey.once('end', () => conn.end());
                };

                if (monkey.stream.readyState !== 'closed') {
                    return hookMonkey();
                }

                conn.end();
                // if attempts fail, return monkey anyway
                return attempts === 0
                    ? hookMonkey()
                    : establishConnection(attempts - 1);
            };
            const transport = await this.transport(serial);
            const conn_2 = await new MonkeyCommand(
                transport,
                serial,
                1080
            ).execute();
            return tryConnect(20).then(
                (monkey_1) => tryConnectHandler(conn_2, monkey_1),
                (err) => {
                    conn_2.end();
                    throw err;
                }
            );
        };
        return nodeify(establishConnection(3), cb);
    }

    /**
     * Force stops given package.
     * Analogous to `adb shell am force-stop <package>`.
     */
    killApp(serial: string, pkg: string): Promise<void>;
    killApp(serial: string, pkg: string, cb: Callback): void;
    killApp(serial: string, pkg: string, cb?: Callback): Promise<void> | void {
        return nodeify(
            this.shell(serial, `am force-stop ${pkg}`).then(() => {
                return;
            }),
            cb
        );
    }

    private execInternal(...args: ReadonlyArray<string>): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            execFile(this.options.bin, args, (err, stdout, stderr) => {
                if (err) {
                    return reject(err);
                }
                if (stderr && !stdout) {
                    return reject(
                        new AdbExecError(stderr.trim(), args.join(' '))
                    );
                }
                if (/Error/.test(stdout)) {
                    return reject(
                        new AdbExecError(stdout.trim(), args.join(' '))
                    );
                }
                return resolve(stdout);
            });
        });
    }

    /**
     * Executes a given command via adb console interface.
     */
    exec(cmd: string): Promise<string>;
    exec(cmd: string, cb: ValueCallback<string>): void;
    exec(cmd: string, cb?: ValueCallback<string>): Promise<string> | void {
        return nodeify(this.execInternal(cmd), cb);
    }

    /**
     * Executes a given command on specific device via adb console interface.
     *  Analogous to `adb -s <serial> <command>`.
     */
    execDevice(serial: string, cmd: string): Promise<string>;
    execDevice(serial: string, cmd: string, cb: ValueCallback<string>): void;
    execDevice(
        serial: string,
        cmd: string,
        cb?: ValueCallback<string>
    ): Promise<string> | void {
        return nodeify(this.execInternal(...['-s', serial, cmd]), cb);
    }

    /**
     * Executes a given command on specific device shell via adb console interface.
     * Analogous to `adb -s <serial> shell <command>` .
     */
    execDeviceShell(serial: string, cmd: string): Promise<string>;
    execDeviceShell(
        serial: string,
        cmd: string,
        cb: ValueCallback<string>
    ): void;
    execDeviceShell(
        serial: string,
        cmd: string,
        cb?: ValueCallback<string>
    ): Promise<string> | void {
        return nodeify(this.execInternal(...['-s', serial, 'shell', cmd]), cb);
    }

    /**
     * Retrieves current battery status.
     * Analogous to `adb -s <serial> shell dumpsys battery` .
     */
    batteryStatus(serial: string): Promise<PropertyMap>;
    batteryStatus(serial: string, cb: ValueCallback<PropertyMap>): void;
    batteryStatus(
        serial: string,
        cb?: ValueCallback<PropertyMap>
    ): Promise<PropertyMap> | void {
        return nodeify(
            this.connection().then((conn) => {
                return new BatteryStatusCommand(conn, serial).execute();
            }),
            cb
        );
    }

    /**
     * Removes file/folder specified by `path` parameter.
     * Analogous to `adb shell rm <path>`.
     */
    rm(serial: string, path: string): Promise<void>;
    rm(serial: string, path: string, options: RmOptions): Promise<void>;
    rm(serial: string, path: string, cb: Callback): void;
    rm(serial: string, path: string, options: RmOptions, cb: Callback): void;
    rm(
        serial: string,
        path: string,
        options?: RmOptions | Callback,
        cb?: Callback
    ): Promise<void> | void {
        const { options_, cb_ } = buildFsParams(options, cb);
        return nodeify(
            this.connection().then((conn) => {
                return new RmCommand(conn, serial, path, options_).execute();
            }),
            cb_
        );
    }

    /**
     * Creates directory specified by `path` parameter.
     * Analogous to `adb shell mkdir <path>`.
     */
    mkdir(serial: string, path: string): Promise<void>;
    mkdir(serial: string, path: string, options?: MkDirOptions): Promise<void>;
    mkdir(serial: string, path: string, cb: Callback): void;
    mkdir(
        serial: string,
        path: string,
        options: MkDirOptions,
        cb: Callback
    ): void;
    mkdir(
        serial: string,
        path: string,
        options?: MkDirOptions | Callback,
        cb?: Callback
    ): Promise<void> | void {
        const { options_, cb_ } = buildFsParams(options, cb);
        return nodeify(
            this.connection().then((conn) => {
                return new MkDirCommand(conn, serial, path, options_).execute();
            }),
            cb_
        );
    }

    /**
     * Updates access and modification times of file specified by `path` parameter, or creates a new file.
     * Analogous to `adb shell touch <filename>`.
     */
    touch(serial: string, path: string): Promise<void>;
    touch(serial: string, path: string, options: TouchOptions): Promise<void>;
    touch(serial: string, path: string, cb: Callback): void;
    touch(
        serial: string,
        path: string,
        options: TouchOptions,
        cb: Callback
    ): void;
    touch(
        serial: string,
        path: string,
        options?: TouchOptions | Callback,
        cb?: Callback
    ): Promise<void> | void {
        const { options_, cb_ } = buildFsParams(options, cb);
        return nodeify(
            this.connection().then((conn) => {
                return new TouchCommand(conn, serial, path, options_).execute();
            }),
            cb_
        );
    }

    /**
     * Moves data with `srcPath` to `destPath` parameter.
     * Analogous to `adb shell mv <src> <dest>`.
     */
    mv(serial: string, srcPath: string, destPath: string): Promise<void>;
    mv(
        serial: string,
        srcPath: string,
        destPath: string,
        options: MvOptions
    ): Promise<void>;
    mv(serial: string, srcPath: string, destPath: string, cb: Callback): void;
    mv(
        serial: string,
        srcPath: string,
        destPath: string,
        options: MvOptions,
        cb: Callback
    ): void;
    mv(
        serial: string,
        srcPath: string,
        destPath: string,
        options?: Callback | MvOptions,
        cb?: Callback
    ): Promise<void> | void {
        const { options_, cb_ } = buildFsParams(options, cb);
        return nodeify(
            this.connection().then((conn) => {
                return new MvCommand(
                    conn,
                    serial,
                    [srcPath, destPath],
                    options_
                ).execute();
            }),
            cb_
        );
    }

    /**
     * Copies data with `srcPath` to `destPath` parameter.
     * Analogous to `adb shell cp <src> <dest>`.
     */
    cp(serial: string, srcPath: string, destPath: string): Promise<void>;
    cp(
        serial: string,
        srcPath: string,
        destPath: string,
        options: CpOptions
    ): Promise<void>;
    cp(serial: string, srcPath: string, destPath: string, cb: Callback): void;
    cp(
        serial: string,
        srcPath: string,
        destPath: string,
        options: CpOptions,
        cb: Callback
    ): void;
    cp(
        serial: string,
        srcPath: string,
        destPath: string,
        options?: Callback | CpOptions,
        cb?: Callback
    ): Promise<void> | void {
        const { options_, cb_ } = buildFsParams(options, cb);
        return nodeify(
            this.connection().then((conn) => {
                return new CpCommand(
                    conn,
                    serial,
                    [srcPath, destPath],
                    options_
                ).execute();
            }),
            cb_
        );
    }

    /**
     * Gets file stats for specified path.
     * Analogous to `adb stat <filepath>`.
     */
    fileStat(serial: string, path: string): Promise<FileStat>;
    fileStat(serial: string, path: string, cb: ValueCallback<FileStat>): void;
    fileStat(
        serial: string,
        path: string,
        cb?: ValueCallback<FileStat>
    ): Promise<FileStat> | void {
        return nodeify(
            this.connection().then((conn) => {
                return new FileStatCommand(conn, serial, path).execute();
            }),
            cb
        );
    }
}
