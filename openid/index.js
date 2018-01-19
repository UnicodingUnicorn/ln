/*
Copyright (C) 2018 Daniel Lim Hai

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/

var express = require("express");
var bodyParser = require("body-parser");
var expresshbs = require("express-handlebars");
var cors = require("cors");
var expressBrute = require("express-brute");
var BruteRedis = require("express-brute-redis");

var async = require("async");
var basicauth = require("basic-auth");
var bcrypt = require("bcryptjs");
var bearerToken = require("bearer-token");
var colours = require("colors");
var jwt = require("jsonwebtoken");
var querystring = require("querystring");
var request = require("request");
var uniqid = require("uniqid");
var url = require("url");

var iss = process.env.ISS;

var redis = require("redis");
var openidCache = redis.createClient({
  host : process.env.REDIS_HOST,
  port : process.env.REDIS_PORT,
  db : 2
});

var { Pool } = require("pg");
var db = new Pool({
  host : process.env.PG_HOST,
  port : process.env.PG_PORT,
  database : "postgres",
  user : process.env.PG_USER,
  password : process.env.PG_PASSWORD
});
db.query("SELECT * FROM clients", (err, clients) => {
  if(err){
    console.log(err);
  }else{
    async.each(clients.rows, (client, cb) => {
      openidCache.set(client.id, client.secret, cb);
    }, () => {
      console.log("Client cache generated".green);
    });
  }
});

var app = express();
app.use(cors());
var store = new BruteRedis({
  client : openidCache,
  prefix : 'bp:'
});
var bruteforce = new expressBrute(store);
app.use(express.static(__dirname + "/assets"));
app.engine('handlebars', expresshbs({defaultLayout : 'main'}));
app.set('view engine', 'handlebars');

app.get("/", function(req, res){
  res.status(200).send("Received at OpenID service");
});

app.all('/authorise', bodyParser.json(), bodyParser.urlencoded({extended : true}), function(req, res){
  if(req.method == "GET" || req.method == "POST"){
    var params;
    req.method == "GET" ? params = req.query : params = req.body;
    res.data = {};
    if(params.state)
      res.data.state = params.state;
    if(params.nonce)
      res.data.nonce = params.nonce;
    if(params.login_hint)
      res.data.login_hint = params.login_hint;
    if(params.scope){
      var scope = null;
      res.data.scopes = params.scope;
      async.each(params.scope.split(' '), function(s, s_cb){
        if(s == 'openid')
          scope = s;
        s_cb();
      }, function(err){
        if(scope){
          db.query("SELECT * FROM clients WHERE id = $1", [params.client_id], (get_err, client) => {
            if(!get_err){
                if(!client.rows[0]){
                  res.status(400).json({
                    error : "parameter_rejected",
                    error_description : "Unknown client_id"
                  });
                }else{
                  client = client.rows[0];
                  if(params.redirect_uri == undefined){
                    res.status(400).json({
                      error : "parameter_absent",
                      error_description : "No redirect_uri"
                    });
                  }else{
                    db.query("SELECT * FROM client_redirect_uris WHERE client_id = $1 AND uri = $2", [
                      params.client_id,
                      params.redirect_uri
                    ], (get_uri_err, redirect_uri) => {
                      if(!get_uri_err){
                        if(!redirect_uri.rows[0]){
                          res.status(400).json({
                            error : "parameter_rejected",
                            error_description : "Invalid redirect_uri"
                          });
                        }else{
                          if(client.name)
                            res.data.client_name = client.name;
                          res.data.redirect_uri = encodeURI(redirect_uri.rows[0].uri);
                          if(params.response_type == 'code'){
                            res.data.name = client.name;
                            res.render('code', res.data);
                          }else if(params.response_type == 'id_token' || params.response_type == 'id_token token'){
                            res.data.client_id = params.client_id;
                            if(params.nonce){
                              res.data.name = client.name;
                              res.render('implicit', res.data);
                            }else{
                              res.status(400).json({
                                error : "parameter_absent",
                                error_description : "No nonce"
                              });
                            }
                          }else{
                            res.status(400).json({
                              error : "unsupport_response_type",
                              error_description : "Unknown response_type"
                            });
                          }
                        }
                      }else{
                        console.log(get_uri_err);
                      }
                    });
                  }
                }
            }else{
              console.log(get_err);
            }
          });
        }else{
          res.status(400).json({
            error : "parameter_rejected",
            error_description : "Unknown scope"
          });
        }
      });
    }else{
      res.status(400).json({
        error : "parameter_absent",
        error_description : "No scope"
      });
    }
  }
});

app.post("/authcode", bruteforce.prevent, bodyParser.json(), bodyParser.urlencoded({extended : true}), function(req, res){
  res.data = {
    redirect_uri : req.body.redirect_uri,
    state : req.body.state,
    nonce : req.body.nonce,
    client_id : req.body.client_id,
    client_name : req.body.client_name,
    scopes : req.body.scopes
  };

  db.query('SELECT * FROM users WHERE email = $1', [req.body.email], (err, user) => {
    if(err){
      console.log(err);
    }else{
      if(!user.rows[0]){
        res.data.err_msg = "Email not found";
        res.render('code', res.data);
      }else{
        user = user.rows[0];
        bcrypt.compare(req.body.password, user.password, function(hash_err, result){
          if(result == true){
            var raw_code = {
              user : user,
              auth_time : (new Date()).getTime(),
              nonce : req.body.nonce,
              scopes : req.body.scopes
            };
            var code = uniqid();
            openidCache.set('ac:' + code, JSON.stringify(raw_code), 'EX', 60, function(err){
              if(!(req.body.redirect_uri.match(/(http:\/\/)(\w|\W)+/) || decodeURI(req.body.redirect_uri).match(/(http:\/\/)(\w|\W)+/) || req.body.redirect_uri.match(/(https:\/\/)(\w|\W)+/) || decodeURI(req.body.redirect_uri).match(/(https:\/\/)(\w|\W)+/)))
                req.body.redirect_uri = "http://" + req.body.redirect_uri;
              if(req.body.redirect_uri[req.body.redirect_uri.length - 1] == '/')
                req.body.redirect_uri = req.body.redirect_uri.substring(0, req.body.redirect_uri.length);
              res.render('redirect', {redirect_url : req.body.redirect_uri + '?' + querystring.stringify({
                state : req.body.state,
                code : code
              }), layout : 'redirect'});
            });
          }else{
            res.data.err_msg = "Invalid password";
            res.render('code', res.data);
          }
        });
      }
    }
  });
});

app.post("/implicit", bruteforce.prevent, bodyParser.json(), bodyParser.urlencoded({extended : true}), function(req, res){
  res.data = {
    redirect_uri : req.body.redirect_uri,
    state : req.body.state,
    nonce : req.body.nonce,
    client_id : req.body.client_id,
    client_name : req.body.client_name,
    scopes : req.body.scopes
  };

  db.query('SELECT * FROM users WHERE email = $1', [req.body.email], (err, user) => {
    if(err){
      console.log(err);
    }else{
      if(!user.rows[0]){
        res.data.err_msg = "Email not found";
        res.render('implicit', res.data);
      }else{
        user = user.rows[0];
        bcrypt.compare(req.body.password, user.password, (hash_err, result) => {
          if(result == true){
            res.set({
              'Cache-Control' : 'no-store',
              'Pragma' : 'no-cache'
            });
            var now = (new Date()).getTime();
            var id_token = {
              iss : iss,
              sub : user.id,
              aud : req.body.client_id,
              exp : now + 10 * 60 * 1000,
              iat : now,
              auth_time : (new Date()).getTime(),
              nonce : req.body.nonce
            };

            var access_token = uniqid();
            openidCache.set('id:' + access_token, jwt.sign({
              sub : user.id,
              scopes : req.body.scopes
            }, access_token), 'EX', 60, function(err){
              if(!(req.body.redirect_uri.match(/(http:\/\/)(\w|\W)+/) || decodeURI(req.body.redirect_uri).match(/(http:\/\/)(\w|\W)+/) || req.body.redirect_uri.match(/(https:\/\/)(\w|\W)+/) || decodeURI(req.body.redirect_uri).match(/(https:\/\/)(\w|\W)+/)))
                req.body.redirect_uri = "http://" + req.body.redirect_uri;
              if(req.body.redirect_uri[req.body.redirect_uri.length - 1] == '/')
                req.body.redirect_uri = req.body.redirect_uri.substring(0, req.body.redirect_uri.length);
              openidCache.get(req.body.client_id, function(cg_err, client_secret){
                res.render('redirect', {redirect_url : req.body.redirect_uri + '?' + querystring.stringify({
                  state : req.body.state,
                  access_token : access_token,
                  id_token : jwt.sign(id_token, client_secret),
                  token_type : "Bearer",
                  expires_in : 10 * 60 * 1000,
                  nonce : req.body.nonce
                }), layout : 'redirect'});
              });
            });
          }else{
            res.data.err_msg = "Invalid password";
            res.render('implicit', res.data);
          }
        });
      }
    }
  });
});

app.post("/token", bodyParser.json(), bodyParser.urlencoded({extended : true}), function(req, res){
  if(req.body.grant_type == 'authorization_code' || req.body.grant_type == 'authorisation_code'){
    var auth = basicauth(req);
    db.query("SELECT secret FROM clients WHERE id = $1", [auth.name], (cerr, client_secret) => {
      if(cerr){
        console.log(cerr);
      }else{
        if(!client_secret.rows[0]){
          res.status(400).json({
            error : "invalid_client",
            error_description : "Client with ID not found"
          });
        }else{
          if(auth.pass === client_secret.rows[0]){
            db.query("SELECT * FROM client_redirect_uris WHERE redirect_uri = $1", [req.body.redirect_uri], (ru_err, ru) => {
              if(ru_err){
                console.log(ru_err);
              }else{
                if(!ru.rows[0]){
                  res.status(400).json({
                    error : "parameter_rejected",
                    error_description : "Invalid redirect_uri"
                  });
                }else{
                  openidCache.get('ac:' + req.body.code, function(r_err, code_body){
                    openidCache.del('ac:' + req.body.code, function(del_err){
                      if(code_body != undefined){
                        res.set({
                          'Cache-Control' : 'no-store',
                          'Pragma' : 'no-cache'
                        });
                        code_body = JSON.parse(code_body);
                        var now = (new Date()).getTime();
                        var id_token = {
                          iss : iss,
                          sub : code_body.user._id,
                          aud : auth.name,
                          exp : now + 10 * 60 * 1000,
                          iat : now,
                          auth_time : code_body.auth_time,
                          nonce : code_body.nonce
                        };

                        var access_token = uniqid();
                        openidCache.set('id:' + access_token, jwt.sign({
                          sub : code_body.user._id,
                          scopes : code_body.scopes
                        }, access_token), 'EX', 60, function(set_iderr){
                          res.status(200).json({
                            id_token : jwt.sign(id_token, auth.pass),
                            token_type : "Bearer",
                            expires_in : 60,
                            access_token : access_token,
                            refresh_token : ''
                          });
                        });
                      }else{
                        res.status(400).json({
                          error : "parameter_rejected",
                          error_description : "Invalid authorisation_code"
                        });
                      }
                    });
                  });
                }
              }
            });
          }else{
            res.status(401).json({
              error : "invalid_client_secret",
              error_description : "Invalid client secret."
            });
          }
        }
      }
    });
  }else{
    res.status(400).json({
      error : "parameter_rejected",
      error_description : "Unknown grant_type"
    });
  }
});

app.options('/userinfo', cors());
app.get("/userinfo", bodyParser.json(), bodyParser.urlencoded({extended : true}), function(req, res){
  bearerToken(req, function(tok_err, token){
    if(tok_err){
      res.status(401).json({
        error : "invalid_token",
        error_description : "Invalid Bearer Auth"
      });
    }else{
      openidCache.get('id:' + token, function(m_err, id_token){
        if(m_err){
          res.status(401).json({
            error : "invalid_token",
            error_description : "Cannot find Access Token"
          });
        }else{
          jwt.verify(id_token, token, function(verify_err, id){
            if(verify_err){
              res.status(401).json({
                error : "invalid_token",
                error_description : "Cannot verify Access Token"
              });
            }else{
              db.query("SELECT * FROM users WHERE id = $1", [id.sub], (get_err, user) => {
                if(get_err || !user.rows[0]){
                  res.status(200).json({});
                }else{
                  user = user.rows[0];
                  var scopes = id.scopes.split(' ');
                  var return_data = {sub : id.sub};
                  for(var i = 0; i < scopes.length; i++){
                    if(scopes[i] == "profile"){
                      return_data.name = user.name;
                      return_data.username = user.username;
                      return_data.gender = user.gender;
                      return_data.birthdate = user.dob;
                      return_data.avatar = user.avatar;
                    }else if(scopes[i] == "email"){
                      return_data.email = user.email;
                    }
                  }
                  res.status(200).json(return_data);
                }
              });
            }
          });
        }
      });
    }
  });
});

app.listen(process.env.OPENID_PORT, function(err){
  err ? console.error(err) : console.log(("OpenID service up at " + process.env.OPENID_PORT).green);
});
