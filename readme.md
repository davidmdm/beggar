# Beggar

> :warning: This module is new and looking for feedback. It has not yet reached version semver v1.0.0 : **Not recommended to be used in production**

## Preamble

Beggar is heavily inspired by mikael's request module.

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
- followRedirects  
   `boolean` will follow all redirects if true
- json  
  `boolean` will parse the response body as JSON.
- headers  
   `object` object containing headers
- auth  
  `object` object containg username and password used for Basic Authentication
  - user
    `string`
  - pass
    `string`
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
- decompress  
   `boolean` by default true. Will decompress encodings br,gzip, and deflate. Set to false to get raw buffer

The request function supports two signatures:

```javascript
request(options);
```

and

```javascript
request(uri, options);
```

In the latter the uri can be either a `string` or a `URL` object and will take precedence over `options.uri`

For convenience all http verb methods defined in http.METHODS are attached to the request function object and will take precedence over `options.method`

```javascript
request.get(uri);
request.post(uri, { body: 'data' });
```

#### Examples

Bring begger's request function into scope:

```javascript
const { request } = require('beggar');
```

Using the native http Incoming message object

```javascript
const req = request.post('http://localhost:3000');
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
request
  .get('http://example.com/file.txt')
  .pipe(request.post('http://bucket.com/upload'))
  .pipe(myWritable);
```

Using promises and `async/await`

```javascript
const response = await request.get('http://localhost:3000');
// response.body will be the result body as a buffer.
// If options.json was set to true the result will be parsed as JSON.
// If options.followRedirects was set to true and redirects occured they urls will be stored on response.redirects
```

_(note)_ for those interested: request(..) does not return an instance of a Promise, However it is thenable/catchable and therefore async/await compliant.

Mixing them together

```javascript
const file = fs.createReadStream('./file.txt');
const request = file.pipe(request.put('http://destination.com'));
const response = await request;
```

### RoadMap

There are some things that could be improved upon. A few that come to mind:

- multi-part formdata options
- redirect options
- proxy support
- cookie support
- providing custom agent
- perhaps utility functions that bypass returning a response object all together
  ```javascript
  const obj = await request.get(uri).asJSON();
  const str = await request.get(uri).asString();
  const buff = await request.get(uri).asBuffer();
  ```

### Contributing

Contributions and feedback are more than welcome. If this never becomes more than a small personal project I am happy with that too, and thank anybody who takes the time look at it or give feedback.
