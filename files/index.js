var express = require("express");
var bodyParser = require("body-parser");
//var busboy = require("connect-busboy");
var cors = require("cors");

var multer = require('multer');
var storage = multer.memoryStorage();
var upload = multer({
  fileSize : 2000000000, //2GB
  storage : storage
});

var minio = require("minio");
var mClient = new minio.Client({
  endPoint : 'minio',
  port : 9000,
  secure : false,
  accessKey : process.env.MINIO_ACCESS_KEY,
  secretKey : process.env.MINIO_SECRET_KEY
});

var colours = require("colors");
var jwt = require("jsonwebtoken");
var secret = process.env.SECRET;
var uniqid = require("uniqid");

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));
app.use(cors());

// app.use(busboy());

app.get('/', function(req, res){
  res.status(200).json({
    message : "Received at Files API"
  });
});

app.options('/file', cors());
app.post('/file', upload.single('file'), function(req, res){
  var user = req.get('User');
  if(user){
    if(req.file){
      mClient.bucketExists(user, function(exists_err){
        if(exists_err){
          mClient.makeBucket(user, 'ap-southeast-1', function(make_err){
            if(make_err){
              console.log(make_err);
              res.status(500).json({
                message : "Error storing file"
              });
            }else{
              var id = uniqid() + '.' + req.file.originalname.split('.')[req.file.originalname.split('.').length-1];
              mClient.putObject(user, id, req.file.buffer, function(put_err, etag){
                if(put_err){
                  console.log(put_err);
                  res.status(500).json({
                    message : "Error storing file"
                  });
                }else{
                  res.status(200).json({
                    message : "Success",
                    etag : etag
                  });
                }
              });
            }
          });
        }else{
          var id = uniqid() + '.' + req.file.originalname.split('.')[req.file.originalname.split('.').length-1];
          mClient.putObject(user, id, req.file.buffer, function(put_err, etag){
            if(put_err){
              console.log(put_err);
              res.status(500).json({
                message : "Error storing file"
              });
            }else{
              res.status(200).json({
                message : "Success",
                filename : id,
                originalname : req.file.originalname
              });
            }
          });
        }
      });
    }else{
      res.status(400).json({
        message : "No file"
      });
    }
  }else{
    res.status(404).json({
      message : 'No user found'
    });
  }
});

app.get('/file/:user/:id', function(req, res){
  mClient.getObject(req.params.user, req.params.id, function(err, stream){
    if(err){
      if(err.code == 'NoSuchKey'){
        res.status(400).json({
          message : "No such file"
        });
      }else{
        res.status(500).json({
          message : "Error retrieving file"
        });
      }
    }else{
      stream.pipe(res);
    }
  });
});

app.listen(process.env.FILES_PORT, function(err){
  err ? console.error(err) : console.log(("Files API up at " + process.env.FILES_PORT).rainbow);
})
