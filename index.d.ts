/// <reference types="node" />
import { URL } from 'url';
import { IncomingMessage, Agent } from 'http';
import { Readable, Duplex } from 'stream';
declare type Dictionary<T> = Partial<Record<string, T>>;
export declare type RequestOptions = {
  method?: string;
  uri: string | URL;
  followRedirects?: boolean;
  headers?: Dictionary<string | string[]>;
  auth?: {
    user: string;
    pass: string;
  };
  body?: Buffer | string | Object;
  form?: Dictionary<any>;
  qs?: Dictionary<any>;
  query?: Dictionary<any>;
  formData?: Dictionary<string | Buffer | Readable>;
  decompress?: boolean;
  agent?: Agent | false;
  proxy?: string | URL;
  rejectError?: boolean;
  raw?: boolean;
};

type PartialRequestOptions = Partial<RequestOptions>;

export declare type ResolvedResponse = IncomingMessage & {
  body: any;
  redirects?: string[];
};
export declare type Connection = Duplex & Promise<ResolvedResponse>;

export declare type RequestFunction = {
  (options: RequestOptions): Connection;
  (uri: string | URL, options?: PartialRequestOptions): Connection;
};

type UriOption = { uri: string | URL };
type DefaultUriRequestFunction = {
  (options: PartialRequestOptions): Connection;
  (uri: string | URL, options?: PartialRequestOptions): Connection;
};

export declare const request: RequestFunction & {
  get: RequestFunction;
  post: RequestFunction;
  put: RequestFunction;
  patch: RequestFunction;
  head: RequestFunction;
  delete: RequestFunction;
  defaults: <T extends Partial<RequestOptions>>(
    options: T
  ) => (T extends UriOption ? DefaultUriRequestFunction : RequestFunction) & {
    get: T extends UriOption ? DefaultUriRequestFunction : RequestFunction;
    post: T extends UriOption ? DefaultUriRequestFunction : RequestFunction;
    put: T extends UriOption ? DefaultUriRequestFunction : RequestFunction;
    patch: T extends UriOption ? DefaultUriRequestFunction : RequestFunction;
    head: T extends UriOption ? DefaultUriRequestFunction : RequestFunction;
    delete: T extends UriOption ? DefaultUriRequestFunction : RequestFunction;
  };
};
export {};
