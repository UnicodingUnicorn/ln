var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");

var basicauth = require("basic-auth");
var bcrypt = require("bcrypt");
var salt_rounds = 10;
var uniqid = require("uniqid");

var colors = require("colors");

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
var channels_design = {
  'views' : {
    'by_group_channel' : {
      'map' : function(doc){
        emit([doc.group, doc.channel], doc._id);
      }
    }
  }
}
var channels;
creator(nano, 'channels', {name : 'channels', doc : channels_design}, function(db){
  channels = db;
});
var clients;
creator(nano, 'clients', function(db){
  clients = db;
});

var permissions_design = {
  'views' : {
    'by_user_action' : {
      'map' : function(doc){
        emit([doc.user, doc.action], doc.value);
      }
    },
    'by_user_action_scope' : {
      'map' : function(doc){
        emit([doc.user, doc.action, doc.scope], doc.value);
      }
    },
    'by_user' : {
      'map' : function(doc){
        emit(doc.user, doc._id);
      }
    },
    'by_action_scope' : {
      'map' : function(doc){
        emit([doc.action, doc.scope], doc.value);
      }
    }
  }
};
var permissions;
creator(nano, 'permissions', {name : 'permissions', doc : permissions_design}, function(db){
  permissions = db;
});

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));
app.use(cors());

var getAuth = function(req, res, next){
  console.log(req.get('Authorization'));
  var user = basicauth(req);
  if(user){
    req.auth = {};
    req.auth.username = user.name;
    req.auth.pass = user.pass;
    next();
  }else{
    res.status(401).json({
      message : "No auth header"
    });
  }
  //
  // var authHeader = req.get('Authorization');
  // if(authHeader && authHeader.split(' ')[0] == 'Basic'){
  //   req.auth = {};
  //   var userpass = authHeader.split(' ')[1];
  //   req.auth.username = userpass.split(':')[0];
  //   req.auth.pass = userpass.split(':')[1];
  //   next();
  // }else{
  //   res.status(400).json({
  //     message : "No auth header"
  //   });
  // }
}

/**
 * @api {get} / Ping API
 * @apiName Ping
 * @apiDescription Simple ping to make sure the service is up and running.
 * @apiGroup General
 *
 * @apiSuccess {String} message Received at Admin API
 */
app.get("/", function(req, res){
  res.status(200).json({
    message : "Received at Admin API"
  });
});

/**
 * @api {post} /user Post new user
 * @apiName New user
 * @apiDescription Adds a new user to the database.
 * @apiGroup User
 *
 * @apiParam {String} id User's unique id
 * @apiParam {String} dob User's DOB, formatted in JS Date style
 * @apiParam {String} name User's name
 * @apiParam {String} email User's email
 * @apiParam {String} gender Single character indicating user's gender (m or f)
 * @apiParam {String} password User's password
 *
 * @apiSuccess {String} message Success!
 * @apiSuccess {json} user Object defining user
 *
 * @apiError Missing <foo> field A certain field is not filled in.
 *
 * @apiError ErrorHashingPassword Self-explanatory
 */
app.options("/user", cors());
app.post("/user", getAuth, function(req, res){
  if(!req.body.id){
    res.status(400).json({
      message : "Missing id field"
    });
  }else if(!req.body.name){
    res.status(400).json({
      message : "Missing name field"
    });
  }else if(!req.body.username){
    res.status(400).json({
      message : "Missing username field"
    });
  }else if(!req.body.email){
    res.status(400).json({
      message : "Missing email field"
    });
  }else if(!req.body.password){
    res.status(400).json({
      message : "Missing password field"
    });
  }else if(!req.body.gender){
    res.status(400).json({
      message : "Missing gender field"
    });
  }else if(!req.body.dob){
    res.status(400).json({
      message : "Missing dob field"
    });
  }else{
    bcrypt.hash(req.body.password, salt_rounds, function(hash_err, hash){
      if(hash_err){
        res.status(500).json({
          message : "Error hashing password",
          data : hash_err
        });
      }else{
        var user = {
          dob : req.body.dob,
          name : req.body.name,
          username : req.body.username,
          email : req.body.email,
          gender : req.body.gender,
          password : hash
        };
        nano.config.url = "http://" + req.auth.username + ":" + req.auth.pass + "@couchdb:5984"
        users.insert(user, req.body.id, function(err, body){
          nano.config.url = "http://" + process.env.COUCHDB_USER + ":" + process.env.COUCHDB_PASSWORD + "@couchdb:5984"
          if(err){
            res.status(500).json({
              message : err.message,
              data : err
            });
          }else{
            users.get(body.id, function(uerr, user){
              res.status(200).json({
                message : "Success!",
                user : user
              });
            });
          }
        });
      }
    });
  }
});

app.options("/user/:id", cors());
app.post("/user/:id", getAuth, function(req, res){
  users.get(req.params.id, function(get_err, user){
    if(get_err){
      res.status(500).json({
        message : get_err.message
      });
    }else{
      var user_data = {
        dob : req.body.dob,
        name : req.body.name,
        email : req.body.email,
        gender : req.body.gender
      };
      if(!user_data.dob)
        user_data.dob = user.dob;
      if(!user_data.name)
        user_data.name = user.name;
      if(!user_data.email)
        user_data.email = user.email;
      if(!user_data.gender)
        user_data.gender = user.gender;
      if(req.body.password){
        user_data.password = bcrypt.hashSync(req.body.password, 10);
      }else{
        user_data.password = user.password;
      }
      user_data._rev = user._rev;
      nano.config.url = "http://" + req.auth.username + ":" + req.auth.pass + "@couchdb:5984";
      users.insert(user_data, req.params.id, function(ins_err, body){
        nano.config.url = "http://" + process.env.COUCHDB_USER + ":" + process.env.COUCHDB_PASSWORD + "@couchdb:5984"
        if(ins_err){
          res.status(500).json({
            message : ins_err.message
          });
        }else{
          res.status(200).json({
            message : "Success!"
          });
        }
      });
    }
  });
});

/**
 * @api {delete} /user/:id Delete a user
 * @apiName Delete user
 * @apiDescription Deletes a specified user from the database.
 * @apiGroup User
 *
 * @apiParam {String} id User's unique id
 *
 * @apiSuccess {String} message Success!
 */
app.options("/user/:id", cors());
app.delete("/user/:id", getAuth, function(req, res){
  users.get(req.params.id, function(get_err, user){
    if(get_err){
      res.status(500).json({
        message : get_err.message
      });
    }else{
      nano.config.url = "http://" + req.auth.username + ":" + req.auth.pass + "@couchdb:5984"
      users.destroy(req.params.id, user._rev, function(des_err, body){
        nano.config.url = "http://" + process.env.COUCHDB_USER + ":" + process.env.COUCHDB_PASSWORD + "@couchdb:5984"
        if(des_err){
          res.status(500).json({
            message : des_err.message
          });
        }else{
          res.status(200).json({
            message : "Success!"
          });
        }
      });
    }
  });
});

/**
 * @api {post} /client Post new client
 * @apiName New client
 * @apiDescription Adds a new client to the database.
 * @apiGroup Client
 *
 * @apiParam {String} name Name of the client (for display in login screen)
 * @apiParam {Array} redirect_uri Array of client-submitted redirect uris
 *
 * @apiSuccess {String} message Success!
 * @apiSuccess {json} client Client object data
 *
 * @apiError err The service encountered some error with the database, more appended in the err field
 */
app.post("/client", getAuth, function(req, res){
  var client = {
    name : req.body.name,
    secret : uniqid(),
    redirect_uris : req.body.redirect_uri
  };
  nano.config.url = "http://" + req.auth.username + ":" + req.auth.pass + "@couchdb:5984";
  clients.insert(client, uniqid(), function(err, body){
    nano.config.url = "http://" + process.env.COUCHDB_USER + ":" + process.env.COUCHDB_PASSWORD + "@couchdb:5984";
    if(err){
      res.status(500).json({
        message : err.message
      });
    }else{
      clients.get(body.id, function(g_err, client){
        res.status(200).json({
          message : "Success!",
          client : client
        });
      });
    }
  });
});

/**
 * @api {post} /perms Post new permissions
 * @apiName New permissions
 * @apiDescription Adds a new permission for a user to the database
 * @apiGroup Permissions
 *
 *
 */
app.post("/perms", function(req, res){
  if(req.body.role){
    if(req.body.user){
      perms.insert({
        channel : req.body.channel,
        role : req.body.role,
        user : req.body.user
      }, function(err, perm){
        if(err){
          res.status(400).json({
            message : "err",
            data : err
          });
        }else{
          res.status(200).json({
            message : "Success!"
          });
        }
      });
    }else{
      res.status(400).json({
        message : "Missing user id param"
      });
    }
  }else{
    res.status(400).json({
      message : "Missing role param"
    });
  }
});

app.post("/channel", getAuth, function(req, res){
  if(req.body.channel && req.body.group){
    nano.config.url = "http://" + req.auth.username + ":" + req.auth.pass + "@couchdb:5984";
    channels.insert({
      channel : req.body.channel,
      group : req.body.group,
      users : []
    }, function(err, body){
      nano.config.url = "http://" + process.env.COUCHDB_USER + ":" + process.env.COUCHDB_PASSWORD + "@couchdb:5984";
      if(err){
        res.status(500).json({
          message: err.message
        });
      }else{
        res.status(200).json({
          message : "Success"
        });
      }
    });
  }else{
    res.status(400).json({
      message: "Missing parameter"
    });
  }
});

app.post("/channel/user",  getAuth, function(req, res){
  nano.config.url = "http://" + req.auth.username + ":" + req.auth.pass + "@couchdb:5984";
  channels.view('channels', 'by_group_channel', {
    key : [req.body.group, req.body.channel],
    include_docs : true
  }, function(chan_err, channel_docs){
    if(chan_err){
      res.status(500).json({
        message : chan_err.message
      });
    }else{
      console.log(channel_docs);
      if(channel_docs.rows[0]){
        users.get(req.body.user, function(user_err, user){
          if(user_err){
            res.status(500).json({
              message : user_err.message
            });
          }else{
            permissions.bulk({docs : [{
              user : user._id,
              action : 'send_message',
              scope : {group : req.body.group, channel : req.body.channel},
              value : "1"
            },{
              user : user._id,
              action : 'view_channel',
              scope : {group : req.body.group, channel : req.body.channel},
              value : {group : req.body.group, channel : req.body.channel}
            },{
              user : user._id,
              action : 'send_file',
              scope : {group : req.body.group, channel : req.body.channel},
              value : "1"
            }]}, function(ins_err, body){
              if(ins_err){
                res.status(500).json({
                  message : ins_err.message
                });
              }else{
                var channel = channel_docs.rows[0].doc;
                if(!channel.users.includes(user._id))
                  channel.users.push(user._id);
                channels.insert(channel, function(mod_err, mod_bod){
                  if(mod_err){
                    res.send(mod_err)
                  }else{
                    res.status(200).json({
                      message : "Success"
                    });
                  }
                });
              }
            });
          }
        });
      }else{
        res.status(404).json({
          message : "Channel not found"
        });
      }
    }
  });
});

app.listen(process.env.ADMIN_PORT, function(err){
  err ? console.error(err) : console.log(("Admin API up at " + process.env.ADMIN_PORT).rainbow);
});
