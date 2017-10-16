var express = require("express");
var bodyParser = require("body-parser");
var bearer = require("express-bearer-token");
var cors = require("cors");

var async = require("async");
var colour = require("colors");
var jwt = require("jsonwebtoken");
var secret = process.env.SECRET;

var nano = require("nano")("http://" + process.env.COUCHDB_USER + ":" + process.env.COUCHDB_PASSWORD + "@couchdb:5984");
var creator = require("couchdb-creator");

var messages;
var messages_design = {
  'views' : {
    'by_channel' : {
      'map' : function(doc){
        emit([doc.channel.group, doc.channel.channel], doc._id);
      }
    }
  }
};
creator(nano, 'messages', {name : 'messages', doc : messages_design}, function(db){
  messages = db;
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
        emit(doc.user, doc.value);
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
app.use(bodyParser.urlencoded({ extended : true}));

app.use(cors({
  "preflightContinue": false
}));

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
    message : "Received at Messages API"
  });
});

app.options("/messages/:channel/:count", function(req, res){
  res.status(200);
});
app.get("/messages/:channel/:count", function(req, res){
  if(req.get('User')){
    var gc = JSON.parse(req.params.channel);
    permissions.view("permissions", "by_user_action_scope", {
      key : [req.get('User'), 'view_channel', gc]
    }, function(view_err, channels){
      if(channels.rows[0]){
        messages.view("messages", "by_channel", {
          key : [gc.group, gc.channel],
          include_docs : true,
          limit : req.params.count
        }, function(err, body){
          if(err){
            res.status(200).json({});
          }else{
            var messages_data = [];
            async.each(body.rows, function(message, cb){
              messages_data.push({
                user : message.doc.user,
                datetime : message.doc.datetime,
                message : message.doc.message,
                type : message.doc.type
              });
              cb();
            }, function(iter_err){
              if(iter_err){
                res.status(200).json({});
              }else{
                res.status(200).json(messages_data);
              }
            });
          }
        });
      }else{
        res.status(404).json({
          message : 'No channel found'
        });
      }
    });
  }else{
    res.status(404).json({
      message : 'No user found'
    });
  }
});

app.options("/messages/:channel/:offset/:count", function(req, res){
  res.status(200);
});
app.get("/messages/:channel/:offset/:count", function(req, res){
  if(req.get('User')){
    var gc = JSON.parse(req.params.channel);
    permissions.view("permissions", "by_user_action_scope", {
      key : [req.get('User'), 'view_channel', gc]
    }, function(view_err, channels){
      if(channels.rows[0]){
        messages.view("messages", "by_channel", {
          key : [gc.group, gc.channel],
          include_docs : true,
          limit : req.params.count,
          skip : req.params.offset
        }, function(err, body){
          if(err){
            res.status(200).json({});
          }else{
            var messages_data = [];
            async.each(body.rows, function(message, cb){
              messages_data.push({
                user : message.doc.user,
                datetime : message.doc.datetime,
                message : message.doc.message,
                type : message.doc.type
              });
              cb();
            }, function(iter_err){
              if(iter_err){
                res.status(200).json({});
              }else{
                res.status(200).json(messages_data);
              }
            });
          }
        });
      }else{
        res.status(404).json({
          message : 'No channel found'
        });
      }
    });
  }else{
    res.status(404).json({
      message : 'No user found'
    });
  }


  // perms.view("perms", "by_perm", {
  //   key : [req.decoded.sub, req.params.channel],
  //   include_docs : true
  // }, function(perm_err, role){
  //   if(perm_err){
  //     res.status(400).json({
  //       messages : "No permissions"
  //     });
  //   }else{
  //     if(role.rows[0].value.match(/[rwa]/)){
  //       messages.view("messages", "by_channel", {
  //         key : req.params.channel,
  //         include_docs : true,
  //         limit : req.params.count,
  //         skip : req.params.offset,
  //         descending : true
  //       }, function(err, body){
  //         if(err){
  //           res.status(200).json({});
  //         }else{
  //           var messages_data = [];
  //           async.each(body.rows, function(message, cb){
  //             messages_data.push({
  //               user : message.doc.user,
  //               datetime : message.doc.datetime,
  //               message : message.doc.message,
  //               type : message.doc.type
  //             });
  //             cb();
  //           }, function(iter_err){
  //             if(iter_err){
  //               res.status(200).json({});
  //             }else{
  //               res.status(200).json(messages_data.reverse());
  //             }
  //           });
  //         }
  //       });
  //     }else{
  //       res.status(400).json({
  //         messages : "No permissions"
  //       });
  //     }
  //   }
  // });
});

app.get("/channels", function(req, res){
  if(req.get('User')){
    permissions.view("permissions", "by_user_action", {
      key : [req.get('User'), 'view_channel']
    }, function(view_err, channels){
      var return_channels = [];
      async.each(channels.rows, function(channel, cb){
        return_channels.push(channel.value);
        cb();
      }, function(err){
        res.status(200).json(return_channels);
      });
    });
  }else{
    res.status(404).json({
      message : 'No user found'
    });
  }
});

app.listen(process.env.MESSAGES_PORT, function(err){
  err ? console.error(err) : console.log(("Messages API up at " + process.env.MESSAGES_PORT).rainbow);
})
