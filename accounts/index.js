var express = require("express");
var bodyParser = require("body-parser");
var cors = require("cors");

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

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));
app.use(cors());

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
        email : user.email,
        dob : user.dob,
        gender : user.gender
      });
    }
  });
});

app.post("/user/:id", function(req, res){
  var authHeader = req.get("Authorization");
  if(authHeader){
    var type = authHeader.split(' ')[0];
    if(type == 'Basic'){
      var userpass = authHeader.split(' ')[1].split(':');
      var username = userpass[0];
      var password = userpass[1];
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
    }else if(type == 'Bearer'){
      var token = authHeader.split(' ')[1];
    }else{
      res.status(403).json({
        message : "Invalid authorisation type"
      });
    }
  }else{
    res.status(403).json({
      message : "Authorisation header required"
    });
  }
});

app.listen(process.env.ACCOUNTS_PORT, function(err){
  err ? console.error(err) : console.log(("Accounts API up at " + process.env.ACCOUNTS_PORT).rainbow);
});
