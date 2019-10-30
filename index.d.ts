/// <reference types="node" />
import { URL } from 'url';
import { IncomingMessage } from 'http';
import { Readable, Duplex } from 'stream';
declare type Dictionary<T> = Partial<Record<string, T>>;
export declare type RequestOptions = {
    method?: string;
    uri: string | URL;
    json?: boolean;
    followRedirects?: boolean;
    headers?: Dictionary<string | string[]>;
    auth?: {
        user: string;
        pass: string;
    };
    body?: Buffer | string | Object;
    form?: Dictionary<any>;
    formData?: Dictionary<string | Buffer | Readable>;
};
export declare type ResolvedResponse = IncomingMessage & {
    body: string;
    redirects?: string[];
};
export declare type Connection = Duplex & {
    then: <T>(fn: (response: ResolvedResponse) => T) => Promise<T>;
    catch: <T>(handle: (err: Error) => T) => Promise<ResolvedResponse | T>;
};
declare type RequestOptionsWithoutMethod = Omit<RequestOptions, 'method'>;
declare type RequestFn = {
    (options: RequestOptions): Connection;
    (uri: string | URL | RequestOptions, options?: Omit<RequestOptions, 'uri'>): Connection;
};
declare type MethodlessRequestFn = {
    (options: RequestOptionsWithoutMethod): Connection;
    (uri: string | URL | RequestOptionsWithoutMethod, options?: Omit<RequestOptionsWithoutMethod, 'uri'>): Connection;
};
export declare const request: RequestFn & {
    get: MethodlessRequestFn;
    post: MethodlessRequestFn;
    put: MethodlessRequestFn;
    patch: MethodlessRequestFn;
    head: MethodlessRequestFn;
    delete: MethodlessRequestFn;
};
export {};
