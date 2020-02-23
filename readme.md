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
being promise compatible and to play well with async/await natively.

I would like to keep the module as thin a wrapper over NodeJS's http.ClientRequest and http.IncomingMessage as possible.

### Usage

#### Supported Options

- method  
   `string` (must be HTTP verb)
- uri  
   `string` or `URL`
- headers  
   `object` object containing headers
- body  
  if `Buffer` | `string` | `Readable` body will be written to request as is. Other types will be sent as JSON with the Content-Type header set to `application/json`.
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

#### Examples

Bring begger's request function into scope:

```javascript
const { beggar } = require('beggar');
```

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
