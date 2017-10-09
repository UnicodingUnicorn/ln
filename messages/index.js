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
        emit(doc.channel, doc._id);
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
    }
  }
};
creator(nano, 'perms', {name : 'perms', doc : perms_design}, function(db){
  perms = db;
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
app.get("/messages/:channel/:count", getAuth, function(req, res){
  perms.view("perms", "by_perm", {
    key : [req.decoded.sub, req.params.channel],
    include_docs : true
  }, function(perm_err, role){
    if(perm_err){
      res.status(400).json({
        messages : "No permissions"
      });
    }else{
      if(role.rows[0].value.match(/[rwa]/)){
        messages.view("messages", "by_channel", {
          key : req.params.channel,
          include_docs : true,
          limit : req.params.count,
          descending : true
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
                res.status(200).json(messages_data.reverse());
              }
            });
          }
        });
      }else{
        res.status(400).json({
          message : "No permissions"
        });
      }
    }
  });
});

app.options("/messages/:channel/:offset/:count", function(req, res){
  res.status(200);
});
app.get("/messages/:channel/:offset/:count", getAuth, function(req, res){
  perms.view("perms", "by_perm", {
    key : [req.decoded.sub, req.params.channel],
    include_docs : true
  }, function(perm_err, role){
    if(perm_err){
      res.status(400).json({
        messages : "No permissions"
      });
    }else{
      if(role.rows[0].value.match(/[rwa]/)){
        messages.view("messages", "by_channel", {
          key : req.params.channel,
          include_docs : true,
          limit : req.params.count,
          skip : req.params.offset,
          descending : true
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
                res.status(200).json(messages_data.reverse());
              }
            });
          }
        });
      }else{
        res.status(400).json({
          messages : "No permissions"
        });
      }
    }
  });
});

app.options("/by_time/:timestamp/:offset/:count", function(req, res){
  res.status(200);
});
app.get("/by_time/:timestamp/:offset/:count", getAuth, function(req, res){
  
});

app.get("/channels", getAuth, function(req, res){
  perms.view("perms", "by_user", {
    key : req.decoded.sub,
    include_docs : true
  }, function(view_err, channels){
    var return_channels = [];
    async.each(channels.rows, function(channel, cb){
      return_channels.push(channel.value);
      cb();
    }, function(err){
      res.status(200).json(return_channels);
    });
  });
});

app.listen(process.env.MESSAGES_PORT, function(err){
  err ? console.error(err) : console.log(("Messages API up at " + process.env.MESSAGES_PORT).rainbow);
})
