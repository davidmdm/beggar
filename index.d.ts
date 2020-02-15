/// <reference types="node" />
import { URL } from 'url';
import { IncomingMessage } from 'http';
import { Readable, Duplex } from 'stream';
declare type Dictionary<T> = Partial<Record<string, T>>;
declare type JsonOption = { json: true };
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
  qs?: Dictionary<any>;
  query?: Dictionary<any>;
  formData?: Dictionary<string | Buffer | Readable>;
  decompress?: boolean;
};

type RequestOptionsWithoutUri = Omit<RequestOptions, 'uri'>;

export declare type ResolvedResponse<T> = IncomingMessage & {
  body: T;
  redirects?: string[];
};
export declare type Connection<T> = Duplex & Promise<ResolvedResponse<T>>;

export declare const request: {
  <T extends RequestOptions>(options: T): Connection<T extends JsonOption ? any : Buffer>;
  <T extends RequestOptionsWithoutUri>(uri: string | URL, options?: T): Connection<T extends JsonOption ? any : Buffer>;
  get: {
    <T extends RequestOptions>(options: T): Connection<T extends JsonOption ? any : Buffer>;
    <T extends RequestOptionsWithoutUri>(uri: string | URL, options?: T): Connection<
      T extends JsonOption ? any : Buffer
    >;
  };
  post: {
    <T extends RequestOptions>(options: T): Connection<T extends JsonOption ? any : Buffer>;
    <T extends RequestOptionsWithoutUri>(uri: string | URL, options?: T): Connection<
      T extends JsonOption ? any : Buffer
    >;
  };
  put: {
    <T extends RequestOptions>(options: T): Connection<T extends JsonOption ? any : Buffer>;
    <T extends RequestOptionsWithoutUri>(uri: string | URL, options?: T): Connection<
      T extends JsonOption ? any : Buffer
    >;
  };
  patch: {
    <T extends RequestOptions>(options: T): Connection<T extends JsonOption ? any : Buffer>;
    <T extends RequestOptionsWithoutUri>(uri: string | URL, options?: T): Connection<
      T extends JsonOption ? any : Buffer
    >;
  };
  head: {
    <T extends RequestOptions>(options: T): Connection<T extends JsonOption ? any : Buffer>;
    <T extends RequestOptionsWithoutUri>(uri: string | URL, options?: T): Connection<
      T extends JsonOption ? any : Buffer
    >;
  };
  delete: {
    <T extends RequestOptions>(options: T): Connection<T extends JsonOption ? any : Buffer>;
    <T extends RequestOptionsWithoutUri>(uri: string | URL, options?: T): Connection<
      T extends JsonOption ? any : Buffer
    >;
  };
};
export {};
