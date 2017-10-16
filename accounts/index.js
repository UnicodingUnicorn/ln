var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");

var async = require("async");
var bcrypt = require("bcrypt");
var salt_rounds = 10;
var colors = require("colors");
var jwt = require("jsonwebtoken");
var secret = process.env.SECRET;

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
var perms;
var perms_design = {
  'views' : {
    'by_perm' : {
      'map' : function(doc){
        emit([doc.user, doc.channel], doc.role);
      }
    },
    'by_user' : {
      'map' : function(doc){
        emit(doc.user, doc.channel);
      }
    },
    'by_channel' : {
      'map' : function(doc){
        emit(doc.channel, doc.user);
      }
    }
  }
};
creator(nano, 'perms', {name : 'perms', doc : perms_design}, function(db){
  perms = db;
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

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));
app.use(cors());

var getAuth = function(req, res, next){
  var token = req.get("Authorization");
  if(token.split(' ')[0] == 'Bearer'){
    if(token.split(' ')[1])
      token = token.split(' ')[1];
    if(token){
      jwt.verify(token, secret, function(err, decoded){
        if(err){
          res.status(400).json({
            message : "Invalid token"
          });
        }else{
          req.decoded = decoded;
          next();
        }
      });
    }else{
      res.status(400).json({
        message : "No token"
      });
    }
  }else{
    res.status(400).json({
      message : "Invalid auth type"
    });
  }
};

app.get("/", function(req, res){
  res.status(200).json({
    message : "Received at Accounts API"
  });
});

app.get("/user/:id", function(req, res){
  users.get(req.params.id, function(get_err, user){
    if(get_err){
      res.status(500).json({
        message : get_err.message
      });
    }else{
      res.status(200).json({
        name : user.name,
        username : user.username,
        email : user.email,
        dob : user.dob,
        gender : user.gender
      });
    }
  });
});

app.post("/user/:id", getAuth, function(req, res){
  if(req.decoded.sub == req.params.id){
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
        nano.config.url = "http://" + process.env.COUCHDB_USER + ":" + process.env.COUCHDB_PASSWORD + "@couchdb:5984"
        users.insert(user_data, req.params.id, function(ins_err, body){
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
  }else{
    res.status(403).json({
      message : 'Not authorised to change this user'
    });
  }
});

app.get('/users/:channel', function(req, res){
  if(req.get('User')){
    var gc = JSON.parse(req.params.channel);
    permissions.view('permissions', 'by_user_action_scope', {
      key : [req.get('User'), 'view_channel', gc]
    }, function(view_err, channel_users){
      if(channel_users.rows[0]){
        channels.view('channels', 'by_group_channel', {
          key : [gc.group, gc.channel],
          include_docs : true
        }, function(chan_err, channel){
          console.log(channel.rows[0].doc);
          if(channel.rows[0]){
            var full_users = {};
            async.each(channel.rows[0].doc.users, function(user_id, cb){
              users.get(user_id, function(get_err, indiv_user){
                if(get_err){
                  cb(get_err.message);
                }else{
                  full_users[user_id] = {
                    name : indiv_user.name,
                    username : indiv_user.username,
                    email : indiv_user.email,
                    dob : indiv_user.dob,
                    gender : indiv_user.gender
                  };
                  cb();
                }
              });
            }, function(err){
              if(err){
                res.status(500).json({
                  message : err.message
                });
              }else{
                res.status(200).json({
                  message : 'Success',
                  users : full_users
                });
              }
            });
          }else{
            res.status(404).json({
              message : "Channel not found"
            });
          }
        });
      }else{
        res.status(404).json({
          message : "Channel not found"
        });
      }
    });
  }else{
    res.status(404).json({
      message : 'No user found'
    });
  }
});

app.listen(process.env.ACCOUNTS_PORT, function(err){
  err ? console.error(err) : console.log(("Accounts API up at " + process.env.ACCOUNTS_PORT).rainbow);
});
