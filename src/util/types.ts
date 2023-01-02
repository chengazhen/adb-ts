/**
 * @module Types
 */

import Command from '../command';
import IpConnect from '../commands/ipConnect';
import TransportCommand from '../commands/transport';
import Connection from '../connection';
import LogcatEntry from '../logcat/entry';

export enum Reply {
    OKAY = 'OKAY',
    FAIL = 'FAIL',
    STAT = 'STAT',
    LIST = 'LIST',
    DENT = 'DENT',
    RECV = 'RECV',
    DATA = 'DATA',
    DONE = 'DONE',
    SEND = 'SEND',
    QUIT = 'QUIT'
}

export type ExecCallback = (err: null | Error) => void;

export type ExecCallbackWithValue<T> = (err: null | Error, value: T) => void;

export type ExecValue<T = void> = Promise<T> | void;

export type DeviceState =
    | 'offline'
    | 'device'
    | 'emulator'
    | 'unauthorized'
    | 'recovery'
    | 'no permissions';

export type AdbExtraType =
    | 'string'
    | 'null'
    | 'bool'
    | 'int'
    | 'long'
    | 'float'
    | 'uri'
    | 'component';

export type AdbExtra =
    | {
          key: string;
          type: 'null';
      }
    | {
          key: string;
          type: 'bool';
          value: boolean;
      }
    | {
          key: string;
          type: 'int' | 'long' | 'float';
          value: number | number[];
      }
    | {
          key: string;
          type: 'string';
          value: string | string[];
      }
    | {
          key: string;
          type: 'component' | 'uri';
          value: string;
      };

export type NonEmptyArray<T> = [T, ...T[]];

export type StartServiceOptions = {
    user?: number | string;
    action?: string;
    data?: string;
    mimeType?: string;
    category?: string | string[];
    flags?: number;
    extras?: AdbExtra | AdbExtra[];
};

export type StartActivityOptions = StartServiceOptions & {
    debug?: boolean;
    wait?: boolean;
};

export interface IAdbDevice {
    id: string;
    state: DeviceState;
    path?: string;
    device?: string;
    model?: string;
    product?: string;
    transportId: string;
    transport: TransportType;
}

export type StatsObject = {
    bytesTransferred: number;
};

export type ReversesForwardsBase = {
    local: string;
    remote: string;
};

export type ReversesObject = ReversesForwardsBase & {
    host: string;
};

export type ForwardsObject = ReversesForwardsBase & {
    serial: string;
};

export type PrimitiveType = string | boolean | number | null | undefined;

export type PropertyValue = PrimitiveType | Date;

export type PrimitiveDictionary = Record<string, PropertyValue>;

export type InstallOptions = {
    reinstall?: boolean;
    test?: boolean;
    internal?: boolean;
    allowDowngrade?: boolean;
    grandPermissions?: boolean;
};

export type UninstallOptions = {
    keepCache?: boolean;
};

export type AdbClientOptionsValues = {
    /**
     * - *default `5037`*
     */
    port: number;
    /**
     * - *path to adb.exe, if not set, env path is taken*
     */
    bin: string;
    /**
     * - *default `localhost`*
     */
    host: string;
    /**
     * - *if false, module will not attempt to start adb server*
     */
    noAutoStart: boolean;
};

/**
 * @see {@link AdbClientOptionsValues}
 */
export type AdbClientOptions = {
    [K in keyof AdbClientOptionsValues]?: AdbClientOptionsValues[K];
};

export type LogcatOptions = {
    clear?: boolean;
    filter?: (entry: LogcatEntry) => boolean;
};

export type LogcatReaderOptions = {
    filter?: (entry: LogcatEntry) => boolean;
};

export type TransportType = 'usb' | 'local';

export type WaitForType = TransportType | 'any';

export type WaitForState =
    | 'device'
    | 'recovery'
    | 'rescue'
    | 'sideload'
    | 'bootloader'
    | 'disconnect';

export type SettingsMode = 'system' | 'global' | 'secure';

export type InputSource =
    | 'dpad'
    | 'keyboard'
    | 'mouse'
    | 'touchpad'
    | 'gamepad'
    | 'touchnavigation'
    | 'joystick'
    | 'touchscreen'
    | 'stylus'
    | 'trackball';

export type InputType =
    | 'text'
    | 'keyevent'
    | 'tap'
    | 'swipe'
    | 'draganddrop'
    | 'press'
    | 'roll';

export type InputOptions = {
    source?: InputSource;
};

export type KeyEventOptions = InputOptions & {
    variant?: 'longpress' | 'doubletap';
};

export type InputDurationOptions = InputOptions & { duration?: number };

export interface CommandConstruct {
    new (connection: Connection): Command;
}

export interface TransportCommandConstruct<T> {
    new (connection: Connection): TransportCommand<T>;
}

export interface IpConnectConstruct {
    new (connection: Connection): IpConnect;
}

export interface IPreExecute<T> {
    preExecute: (...args: any[]) => Promise<T>;
}

export interface ICmd {
    readonly Cmd: string;
}

export type MonkeyCallback<T = null> = (
    err: Error | null,
    value: T | null,
    command: string
) => void;

type ForceFSOption = { force?: boolean };
type NoClobberFSOption = { noClobber?: boolean };
type SymlinkFSoption = { symlink?: boolean };
type RecursiveFSOption = { recursive?: boolean };

export type RmOptions = ForceFSOption & RecursiveFSOption;

export type MkDirOptions = ForceFSOption & {
    mode?: number | string;
    parent?: boolean;
};

export type TouchOptions = SymlinkFSoption & {
    aTime?: boolean;
    mTime?: boolean;
    noCreate?: boolean;
    date?: Date | string;
    time?: Date | string;
    reference?: string;
};

export type MvOptions = NoClobberFSOption & ForceFSOption;

export type PreserveOptions = {
    mode?: boolean;
    ownership?: boolean;
    timestamps?: boolean;
    context?: boolean;
    xattr?: boolean;
    all?: boolean;
};

export type CpOptions = NoClobberFSOption &
    SymlinkFSoption &
    RecursiveFSOption & {
        hardLink?: boolean;
        noDereference?: boolean;
        noFollowSymlinks?: boolean;
        followAllSymlinks?: boolean;
        followListedSymlinks?: boolean;
        preserve?: PreserveOptions;
        delFirst?: boolean;
        delDest?: boolean;
        archive?: boolean;
        update?: boolean;
        preserveTimestamps?: boolean;
        copyToTarget?: boolean;
    };

export type PropertyMap = Map<string, PropertyValue>;
