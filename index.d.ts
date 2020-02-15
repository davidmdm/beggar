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
export declare type ResolvedResponse<T> = IncomingMessage & {
  body: T;
  redirects?: string[];
};
export declare type Connection<T> = Duplex & Promise<ResolvedResponse<T>>;

declare type RequestOptionsWithoutMethod = Omit<RequestOptions, 'method'>;

export declare const request: {
  <T extends RequestOptions>(options: T): Connection<T extends JsonOption ? any : Buffer>;
  <T extends RequestOptionsWithoutMethod>(uri: string | URL | T, options?: Omit<T, 'uri'>): Connection<
    T extends JsonOption ? any : Buffer
  >;
  get: {
    <T extends RequestOptionsWithoutMethod>(options: T): Connection<T extends JsonOption ? any : Buffer>;
    <T extends RequestOptionsWithoutMethod>(uri: string | URL | T, options?: Omit<T, 'uri'>): Connection<
      T extends JsonOption ? any : Buffer
    >;
  };
  post: {
    <T extends RequestOptionsWithoutMethod>(options: T): Connection<T extends JsonOption ? any : Buffer>;
    <T extends RequestOptionsWithoutMethod>(uri: string | URL | T, options?: Omit<T, 'uri'>): Connection<
      T extends JsonOption ? any : Buffer
    >;
  };
  put: {
    <T extends RequestOptionsWithoutMethod>(options: T): Connection<T extends JsonOption ? any : Buffer>;
    <T extends RequestOptionsWithoutMethod>(uri: string | URL | T, options?: Omit<T, 'uri'>): Connection<
      T extends JsonOption ? any : Buffer
    >;
  };
  patch: {
    <T extends RequestOptionsWithoutMethod>(options: T): Connection<T extends JsonOption ? any : Buffer>;
    <T extends RequestOptionsWithoutMethod>(uri: string | URL | T, options?: Omit<T, 'uri'>): Connection<
      T extends JsonOption ? any : Buffer
    >;
  };
  head: {
    <T extends RequestOptionsWithoutMethod>(options: T): Connection<T extends JsonOption ? any : Buffer>;
    <T extends RequestOptionsWithoutMethod>(uri: string | URL | T, options?: Omit<T, 'uri'>): Connection<
      T extends JsonOption ? any : Buffer
    >;
  };
  delete: {
    <T extends RequestOptionsWithoutMethod>(options: T): Connection<T extends JsonOption ? any : Buffer>;
    <T extends RequestOptionsWithoutMethod>(uri: string | URL | T, options?: Omit<T, 'uri'>): Connection<
      T extends JsonOption ? any : Buffer
    >;
  };
};
export {};
