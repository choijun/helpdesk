"use strict";

const
  httpntlm = require('httpntlm'),
  httpreq = require('httpreq'),
  assert = require('assert');

class HelpDeskApi {

  constructor(config) {
    this.config = config;
  }

  connect() {
    return new Promise((resolve, reject) => {
      httpntlm.get(this.config, (err, res) => {
        assert.equal(null, err);
        assert.equal(302, res.statusCode);

        this.options = {
          cookies: res.headers['set-cookie'],
          headers: {'Accept': 'application/json;q=0.9'}
        }

        resolve(this);
      });
    });
  }

  get(uri, cb) {
    httpreq.get(uri, this.options, (err, res) => {
      if (err !== null) {
        cb(err, null);
        return;
      }

      if(!res) {
        err = new Error('No response');
        cb(err, null);
        return;
      }

      if(res.statusCode !== 200) {
        err = new Error('Error response code: ' + res.statusCode);
        err.statusCode = res.statusCode;
        cb(err, null);
        return;
      }

      cb(null, JSON.parse(res.body));
    });
  }

}

module.exports.HelpDeskApi = HelpDeskApi;
