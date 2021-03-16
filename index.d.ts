/// <reference types="node" />
import { URL } from 'url';
import { SecureContextOptions } from 'tls';
import { IncomingMessage, Agent, IncomingHttpHeaders } from 'http';
import { Readable, Duplex } from 'stream';

declare type TlsOptions = SecureContextOptions & {
  rejectUnauthorized?: boolean; // Defaults to true
  servername?: string; // SNI TLS Extension
};
declare type Uri = string | URL;
declare type Dictionary<T> = Partial<Record<string, T>>;
export declare type RequestOptions = {
  method?: string;
  uri: Uri;
  followAllRedirects?: boolean;
  maxRedirects?: number;
  headers?: Dictionary<string | string[]>;
  auth?: {
    user: string;
    pass: string;
  };
  // Request Body body
  body?: Buffer | string | Object;
  form?: Dictionary<any>;
  qs?: Dictionary<any>;
  query?: Dictionary<any>;
  formData?: Dictionary<string | Buffer | Readable>;
  decompress?: boolean;
  agent?: Agent | false;
  proxy?: Uri | { uri: Uri; tls?: TlsOptions };
  rejectError?: boolean;
  raw?: boolean;
  tls?: TlsOptions;
  simple?: boolean;
  path?: string;
};

type PartialRequestOptions = Partial<RequestOptions>;
type Simple = { simple: true };
type WithUri = { uri: Uri };

export declare class CancelError extends Error {}

export declare class HttpError extends Error {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: any;
}

export declare type ResolvedResponse = IncomingMessage & {
  body: any;
  redirects?: string[];
};
export declare type Connection<T> = Promise<T extends Simple ? any : ResolvedResponse> &
  Duplex & { cancel: () => void; isCancelled: boolean };

export declare type RequestFunction = {
  <T extends RequestOptions>(options: T): Connection<T>;
  <T extends Uri>(uri: T): Connection<{ uri: typeof uri }>;
  <T extends PartialRequestOptions>(uri: string | URL, options: T): Connection<T>;
};

type Eval<T> = { [Key in keyof T]: T[Key] } & {};
type Override<A, B> = Eval<Omit<A, Extract<keyof A, keyof B>> & B>;

type DefaultedRequestFunction<D extends PartialRequestOptions> = {
  <T extends Uri>(uri: T): Connection<Override<D, { uri: typeof uri }>>;
  <T extends D extends WithUri ? PartialRequestOptions : RequestOptions>(options: T): Connection<Override<D, T>>;
  <T extends PartialRequestOptions>(uri: string | URL, options: T): Connection<Override<D, T>>;
};

export declare const beggar: RequestFunction & {
  get: RequestFunction;
  post: RequestFunction;
  put: RequestFunction;
  patch: RequestFunction;
  head: RequestFunction;
  delete: RequestFunction;
  defaults: <T extends PartialRequestOptions>(
    options: T
  ) => DefaultedRequestFunction<T> & {
    get: DefaultedRequestFunction<T>;
    post: DefaultedRequestFunction<T>;
    put: DefaultedRequestFunction<T>;
    patch: DefaultedRequestFunction<T>;
    head: DefaultedRequestFunction<T>;
    delete: DefaultedRequestFunction<T>;
  };
};
export {};
