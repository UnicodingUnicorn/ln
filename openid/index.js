var express = require("express");
var bodyParser = require("body-parser");
var expresshbs = require("express-handlebars");
var cors = require("cors");

var async = require("async");
var basicauth = require("basic-auth");
var bcrypt = require("bcrypt");
var bearerToken = require("bearer-token");
var colors = require("colors");
var jwt = require("jsonwebtoken");
var querystring = require("querystring");
var request = require("request");
var uniqid = require("uniqid");
var url = require("url");

var Memcached = require("memcached");
var memcached = new Memcached('memcached:11211')

var nano = require("nano")("http://" + process.env.COUCHDB_USER + ":" + process.env.COUCHDB_PASSWORD + "@couchdb:5984");
var creator = require("couchdb-creator");

var users_design = {
  'views' : {
    'by_email' : {
      'map' : function(doc){
        emit(doc.email, doc._id);
      }
    }
  }
};
var users;
creator(nano, 'users', {name : 'email', doc : users_design}, function(db){
  users = db;
});
var clients;
creator(nano, 'clients', function(db){
  clients = db;
});

var iss = process.env.ISS;

//TODO: SSL
var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));
app.use(cors());

app.use(express.static(__dirname + "/assets"));

app.engine('handlebars', expresshbs({defaultLayout : 'main'}));
app.set('view engine', 'handlebars');

app.get("/", function(req, res){
  res.status(200).send("Received at OpenID service");
});

app.all('/authorise', function(req, res){
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
          clients.get(params.client_id, function(get_err, client){
            if(get_err && get_err.statusCode == 404){
              res.status(400).json({
                error : "parameter_rejected",
                error_description : "Unknown client_id"
              });
            }else{
              if(client.name)
                res.data.client_name = client.name;
              var redirect_uri;
              async.each(client.redirect_uris, function(ru, uricb){
                if(encodeURI(ru) == params.redirect_uri)
                  redirect_uri = ru;
                uricb();
              }, function(err){
                if(redirect_uri){
                  //TODO: Prompt type
                  res.data.redirect_uri = encodeURI(redirect_uri);
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
                  }else if(params.response_type == undefined){
                    res.status(400).json({
                      error : "parameter_absent",
                      error_description : "No redirect_uri"
                    });
                  }else{
                    res.status(400).json({
                      error : "unsupport_response_type",
                      error_description : "Unknown response_type"
                    });
                  }
                }else{
                  res.status(400).json({
                    error : "parameter_rejected",
                    error_description : "Invalid redirect_uri"
                  });
                }
              });
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

app.post("/authcode", function(req, res){
  //TODO:Implement rate limiting
  res.data = {
    redirect_uri : req.body.redirect_uri,
    state : req.body.state,
    nonce : req.body.nonce,
    client_id : req.body.client_id,
    client_name : req.body.client_name,
    scopes : req.body.scopes
  };

  users.view('email', 'by_email', {
    key : req.body.email,
    include_docs : true
  }, function(err, body){
    var user = body.rows[0];
    if(user){
      user = user.doc;
      bcrypt.compare(req.body.password, user.password, function(hash_err, result){
        if(result == true){
          var raw_code = {
            user : user,
            auth_time : (new Date()).getTime(),
            nonce : req.body.nonce,
            scopes : req.body.scopes
          };
          var code = uniqid();
          memcached.set('ac:' + code, JSON.stringify(raw_code), 60, function(err){
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
    }else{
      res.data.err_msg = "Email not found";
      res.render('code', res.data);
    }
  });
});

app.post("/implicit", function(req, res){
  //TODO:Implement rate limiting
  res.data = {
    redirect_uri : req.body.redirect_uri,
    state : req.body.state,
    nonce : req.body.nonce,
    client_id : req.body.client_id,
    client_name : req.body.client_name,
    scopes : req.body.scopes
  };

  users.view('email', 'by_email', {
    key : req.body.email,
    include_docs : true
  }, function(err, body){
    var user = body.rows[0];
    if(user){
      user = user.doc;
      bcrypt.compare(req.body.password, user.password, function(hash_err, result){
        if(result == true){
          res.set({
            'Cache-Control' : 'no-store',
            'Pragma' : 'no-cache'
          });
          var now = (new Date()).getTime();
          var id_token = {
            iss : iss,
            sub : user._id,
            aud : req.body.client_id,
            exp : now + 10 * 60 * 1000,
            iat : now,
            auth_time : (new Date()).getTime(),
            nonce : req.body.nonce
          };

          var access_token = uniqid();
          memcached.set('id:' + access_token, jwt.sign({
            sub : user._id,
            scopes : req.body.scopes
          }, access_token), 60, function(err){
            if(!(req.body.redirect_uri.match(/(http:\/\/)(\w|\W)+/) || decodeURI(req.body.redirect_uri).match(/(http:\/\/)(\w|\W)+/) || req.body.redirect_uri.match(/(https:\/\/)(\w|\W)+/) || decodeURI(req.body.redirect_uri).match(/(https:\/\/)(\w|\W)+/)))
              req.body.redirect_uri = "http://" + req.body.redirect_uri;
            if(req.body.redirect_uri[req.body.redirect_uri.length - 1] == '/')
              req.body.redirect_uri = req.body.redirect_uri.substring(0, req.body.redirect_uri.length);
            clients.get(req.body.client_id, function(cg_err, client){
              res.render('redirect', {redirect_url : req.body.redirect_uri + '?' + querystring.stringify({
                state : req.body.state,
                access_token : access_token,
                id_token : jwt.sign(id_token, client.secret),
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
    }else{
      res.data.err_msg = "Email not found";
      res.render('implicit', res.data);
    }
  });
});

app.post("/token", function(req, res){
  var auth = basicauth(req);
  clients.get(auth.name, function(cerr, client){
    if(cerr && cerr.statusCode == 404){
      res.status(400).json({
        error : "invalid_client",
        error_description : "Client with ID not found"
      });
    }else{
      if(auth.pass == client.secret){
        var redirect_uri = null;
        async.each(client.redirect_uris, function(ru, rucb){
          if(ru == req.body.redirect_uri)
            redirect_uri = ru;
          rucb();
        }, function(err){
          if(redirect_uri){
            if(req.body.grant_type == 'authorization_code' || req.body.grant_type == 'authorisation_code'){
              memcached.get('ac:' + req.body.code, function(r_err, code_body){
                memcached.del('ac:' + req.body.code, function(del_err){
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
                      aud : client._id,
                      exp : now + 10 * 60 * 1000,
                      iat : now,
                      auth_time : code_body.auth_time,
                      nonce : code_body.nonce
                    };

                    var access_token = uniqid();
                    memcached.set('id:' + access_token, jwt.sign({
                      sub : code_body.user._id,
                      scopes : code_body.scopes
                    }, access_token), 60, function(set_iderr){
                      res.status(200).json({
                        id_token : jwt.sign(id_token, client.secret),
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
            }else{
              res.status(400).json({
                error : "parameter_rejected",
                error_description : "Unknown grant_type"
              });
            }
          }else{
            res.status(400).json({
              error : "parameter_rejected",
              error_description : "Invalid redirect_uri"
            });
          }
        });
      }else{
        res.status(401).json({
          error : "invalid_client_secret",
          error_description : "Invalid client secret."
        });
      }
    }
  });
});

app.options('/userinfo', cors());
app.get("/userinfo", function(req, res){
  console.log(req.get('Authorization'));
  bearerToken(req, function(tok_err, token){
    if(tok_err){
      res.status(401).json({
        error : "invalid_token",
        error_description : "Invalid Bearer Auth"
      });
    }else{
      console.log(token);
      memcached.get('id:' + token, function(m_err, id_token){
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
              users.get(id.sub, function(get_err, user){
                if(get_err){
                  res.status(200).json({});
                }else{
                  var scopes = id.scopes.split(' ');
                  var return_data = {sub : id.sub};
                  for(var i = 0; i < scopes.length; i++){
                    if(scopes[i] == "profile"){
                      return_data.name = user.name;
                      return_data.username = user.username;
                      return_data.gender = user.gender;
                      return_data.birthdate = user.dob;
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

app.options('/verify/:token/:target_url', cors());
app.all('/verify/:token/:target_url', function(req, res){
  if(req.params.target_url){
    var auth = basicauth(req);
    if(auth){
      clients.get(auth.name, function(get_err, client){
        if(get_err){
          res.status(403).send("Forbidden");
        }else{
          if(client.secret === auth.pass){
            jwt.verify(req.params.token, client.secret, function(ver_err, decoded){
              if(ver_err){
                res.status(403).send("Forbidden");
              }else{
                req.headers['User'] = decoded.sub;
                req.pipe(request(req.params.target_url).on('error', function(err){
                  res.status(404).send("Not found");
                })).pipe(res);
              }
            });
          }else{
            res.status(403).send("Forbidden");
          }
        }
      });
    }else{
      res.status(401).send("No client auth header");
    }
  }else{
    res.status(404).send("Target not found");
  }
});

app.listen(process.env.OPENID_PORT, function(err){
  err ? console.error(err) : console.log(("OpenID service up at " + process.env.OPENID_PORT).rainbow);
});
