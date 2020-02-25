# Beggar

> :warning: This module is new and looking for feedback. It has not yet reached version semver v1.0.0 : **Not recommended to be used in production**

## Preamble

Beggar is heavily inspired by mikael's [request](https://www.npmjs.com/package/request) module.

Every other http client library I tried always left me wanting and I would always come back to request.
In my opinion, what request did better than any other http client library was its stream interface.

```javascript
request('http://localhost:3000/myfile.txt').pipe(fs.createWriteStream('./filesystem/file.txt'));
```

Even streaming the body into the request.

```javascript
const { pipeline } = require('stream');

pipeline(
  fs.createReadStream('./data.csv'),
  request({ method: 'post', uri: 'http://localhost:3000/upload' }),
  process.stdout,
  err => console.error(err.message)
);
```

It was a great abstraction over NodeJS's http.ClientRequest and http.IncomingMessage objects.

In contrast what it struggled more than any other http client library was at adapting to javascript's Promise API.

Nobody wants to write this over and over:

```javascript
const { promisify } = require('util');
const request = promisify(require('request'));
```

You lose access to utility functions such as `request.post(...)` and `request.put(...)` when you promisify over the module.
Modules like request-promise partially solve this issue but then we lose the stream interface.

### Goal

Beggar aims to offer a similar API to Mikael's request and to remain true to its bidirectional streaming support, whilst
being promise compatible and play well with async/await natively.

I would like to keep the module as thin a wrapper over NodeJS's http.ClientRequest and http.IncomingMessage as possible.

### Supported features

- Stream support
- Promise support via `then` and `catch`
- Implicit parsing of response body (json, string, buffer)
- form and multipart-form requests
- Specify number of maximum redirections
- Basic Auth
- Automatic decompression of gzip, deflate and br compressions
- Can reject non 2xx statusCode responses automatically
- Proxying support for http proxies
- Request Cancelation
- Extending with user provided default options

### Usage

#### Supported Options

- method  
   `string` (must be HTTP verb)
- uri  
   `string` or `URL`
- headers  
   `object` object containing headers
- body  
   `Buffer` | `string` | `Readable` if body is a string or buffer the body will be written to the underlying request request as is. Other types will be stringified and sent as JSON with the Content-Type header set to `application/json`.
- form  
  `object` will be url-encoded using the qs library and sent with Content-Type header set to `application/x-www-form-urlencoded`
- formData  
  `object` will be used with form-data library to create a multi-part from request
- qs  
   `object` will use qs library to generate appropriate query. Has precedence over `option.query`. If query string is part of `options.uri` it will only write over the fields it defines but preserve the rest
- query  
   `object` same as `options.qs` but will use the NodeJS native querystring module.
- auth  
  `object` object containg username and password used for Basic Authentication
  - user
    `string`
  - pass
    `string`
- maxRedirects  
   `number` the maximum number of redirects for begger to follow
- followAllRedirects  
   `boolean` will follow all redirects if true and maxRedirects not specified
- decompress  
   `boolean` by default true. Will decompress encodings br,gzip, and deflate. Set to false to get raw buffer
- agent  
   `http.Agent` or `false`, will be passed to underlying NodeJS ClientRequest
- proxy  
   `string` | `URL` | { uri: `string` | `URL`; tls: `object` } Uri of the http proxy server. tls
  options specific to the proxy can be passed here as well.
- rejectError  
   `boolean` default false. Will reject an error containing response headers, body, statusCode and message on statusCodes outside of the 2xx range
- raw  
   `boolean` default false. If true will bypass Beggars implicity body parsing and response.body will be a Buffer instance
- tls  
   `object` tls options that will be passed to https.request. For more documentation on tls options please read the official NodeJS documentation [https://nodejs.org/api/https.html#https_https_request_options_callback](here)

The request function supports two signatures:

```javascript
beggar(options);
```

and

```javascript
beggar(uri, options);
```

In the latter the uri can be either a `string` or a `URL` object and will take precedence over `options.uri`

For convenience all http verb methods defined in http.METHODS are attached to the request function object and will take precedence over `options.method`

```javascript
beggar.get(uri);
beggar.post(uri, { body: 'data' });
```

### Examples

Bring begger's request function into scope:

```javascript
const { beggar } = require('beggar');
```

#### Basic Usage

Using the native http Incoming message object

```javascript
const req = beggar.post('http://localhost:3000');
// If you don't use promises or stream interface you must remember to end your request
// Exceptionally if the request is a GET beggar will know no data shall be written and
// will close it for you.
req.write('some data');
req.end();

req.on('response', response => {
  // Response is the NodeJS http.IncomingMessage
});
```

Using the stream interface (same as Mikael's request)

```javascript
// It is best to use pipeline to assure that streams get closed properly on error. For simplicity in other examples we shall use the readable pipe method.
pipeline(
  beggar.get('http://example.com/file.txt'),
  beggar.post('http://bucket.com/upload'),
  fs.createWriteStream('./response.json'),
  err => { ... }
)

```

Using promises and `async/await`

```javascript
const response = await beggar.get('http://localhost:3000');
// response.body will be parsed according to the response header Content-Type and will either be a Javascript Object,
// a string or an instance of Buffer.
// If options.followRedirects was set to true and redirects occured they urls will be stored on response.redirects
```

_(note)_ for those interested: beggar(..) does not return an instance of a Promise, However it is thenable/catchable and therefore async/await compliant.

Mixing them together

```javascript
const file = fs.createReadStream('./file.txt');
const request = file.pipe(beggar.put('http://destination.com'));
const response = await request;
```

#### Sending Headers

```javascript
beggar.get(uri, { headers: { 'Accept-Encoding': 'application/json' } });
```

#### Sending request with a body

```javascript
// Note that GET requests will not send any payload even if they are passed as options
// Beggar will automatically add the Content-Length to the request for you if it can infer it like in this example.
beggar.post({
  uri: 'https://example.com/upload',
  headers: { 'Content-Type': 'text/plain' },
  body: 'my string payload that could equally be a buffer',
});

// Here the Content-Type will be set as application/json by beggar and the content-length inferred as well.
beggar.put({
  uri: 'https://example.com/resource/1',
  body: { resource: 'values' },
});

// Beggar also support sending readable streams via the body options
beggar.post({
  uri: 'https://example.com/fileUpload',
  body: fs.createReadStream('./path/to/file'),
});
```

#### Sending forms

Beggar will automatically send form-encode the body and set the appropriate Content-Type when the body is sent via the form option.

```javascript
// The following transates to a request with Content-Type: application/x-www-form-urlencoded
// and body: key=value&key2=value2
beggar.post({
  uri: 'https://example.com/form',
  form: { key: 'value', key2: 'value2' },
});
```

#### Multipart form data

Beggar uses formData under the hood to generate multipart requests. Simply provide an object where the keys will be interpreted as name and filename and the values the body of each part.

```javascript
beggar.post({
  uri: 'https://example.com/form',
  formData: { key: 'value' },
});
```

This will write something similar to the request:

```
----------------------------593029851590825188224183
Content-Disposition: form-data; name="key"; filename="key"

value
----------------------------593029851590825188224183--
```

#### Query Strings

Beggar lets you override the given query string programmatically. The next example shall only override the given fields. The qs option uses the [qs](https://www.npmjs.com/package/qs) library for query string encoding. The query options uses the native NodeJS querystring module.

```javascript
beggar.get({
   uri: 'https://example.com?override=willBeOverwritten&stable=willStayAsIs',
   qs: { override: 'new value' },
);

// Using the native NodeJS querystring module for query string encoding/decoding
beggar.get({
   uri: 'https://example.com?override=willBeOverwritten&stable=willStayAsIs',
   query: { override: 'new value' },
);
```

#### Basic Authentication

```javascript
beggar.get('https://protected.com', { auth: { user: 'username', pass: 'password' } });
```

#### Http Proxies

Simply supply the proxy uri and beggar will handle the proxied request. Provide the proxy's basic auth within the URI and it shall be used for Proxy-Authorization Header on proxy connect request.

```javascript
beggar.get({
  uri: 'https://server.com',
  proxy: 'http://username:password@proxy.com:2345',
});
```

#### Request Cancellation

A beggar connection/request object can be cancelled. This will abort the underlying request. Once aborted the beggar request will emit `abort` and `error` with CancelError.

```javascript
const { beggar, CancelError } = require('beggar');

const request = beggar.get('https://example.com');
request.cancel();

request.once('abort', () => console.log('Request aborted'));
request.once('error', err => {
  console.log(err.message); // will log "Request Cancelled"
  console.log(err instanceof CancelError); // true
  console.log(request.isCancelled); // true
});

request
  .then(resp => {
    // response if finished before cancel was called.
  })
  .catch(err => {
    // same instance of CancelError as detected above in error listener
  });
```

#### Defaults

Beggar also supports creating new instance of request with default options.

```javascript
const authenticatedRequest = beggar.defaults({ auth: { user: 'username', pass: 'password' } });

// authenticatedRequest will post to my service with the auth value set.
authenticatedRequest.post('https://myservice.com/upload', { body: 'data' });

// of course it is always possible to override the value in the current options
authenticatedRequest.post({
  uri: 'https://myservice.com/upload',
  body: 'data',
  auth: { user: 'differentUser', pass: 'differentPassword' },
});
```

Note that the `defaults` utility only exists on the root beggar function and not on the functions created by
defaults.

### RoadMap

There are some things that could be improved upon. A few that come to mind:

- multi-part formdata options
- cookie support (if requested)

### Contributing

Contributions and feedback are more than welcome. If this never becomes more than a small personal project I am happy with that too, and thank anybody who takes the time look at it or give feedback.
