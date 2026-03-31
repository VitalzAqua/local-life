const { EventEmitter } = require('events');
const httpMocks = require('node-mocks-http');

async function executeRoute(router, { method = 'GET', url = '/', body, headers } = {}) {
  const req = httpMocks.createRequest({
    method,
    url,
    body,
    headers
  });

  const res = httpMocks.createResponse({
    eventEmitter: EventEmitter
  });

  await new Promise((resolve, reject) => {
    res.on('end', resolve);
    router.handle(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }

      if (!res.writableEnded) {
        resolve();
      }
    });
  });

  return res;
}

module.exports = {
  executeRoute
};
