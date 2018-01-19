SET client_min_messages = 'ERROR';

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  secret TEXT NOT NULL
);

INSERT INTO clients (
  id,
  name,
  secret
) VALUES (
  '406jko1jadsm11w',
  'ln',
  '5b8ead95c34d7b717826533883705cc6efe9971f2345341b8e570d14ba2fdd38'
);

CREATE TABLE IF NOT EXISTS client_redirect_uris (
  id SERIAL NOT NULL,
  client_id TEXT NOT NULL REFERENCES clients (id),
  uri TEXT NOT NULL,
  PRIMARY KEY (id, client_id)
);

INSERT INTO client_redirect_uris (
  client_id,
  uri
) VALUES (
  '406jko1jadsm11w',
  'http://localhost:8080/#/'
), (
  '406jko1jadsm11w',
  'http://192.168.99.100:8080/#/'
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  gender CHAR NOT NULL,
  dob TIMESTAMPTZ NOT NULL,
  avatar TEXT
);

CREATE TABLE IF NOT EXISTS channels (
  "group" TEXT NOT NULL,
  channel TEXT NOT NULL,
  PRIMARY KEY ("group", channel)
);

CREATE TABLE IF NOT EXISTS channel_users (
  "group" TEXT NOT NULL,
  channel TEXT NOT NULL,
  "user" TEXT NOT NULL,
  PRIMARY KEY ("group", channel, "user")
);

CREATE TABLE IF NOT EXISTS permissions (
  "user" TEXT NOT NULL,
  scope TEXT NOT NULL,
  action TEXT NOT NULL,
  PRIMARY KEY ("user", scope, action)
);

CREATE TABLE IF NOT EXISTS admins (
  username TEXT NOT NULL PRIMARY KEY,
  password TEXT NOT NULL
);
INSERT INTO admins (username, password) VALUES (
  'admin',
  'password'
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  datetime TIMESTAMPTZ NOT NULL,
  "user" TEXT NOT NULL,
  "group" TEXT NOT NULL,
  channel TEXT NOT NULL,
  message TEXT NOT NULL,
  type CHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS pms (
  id TEXT PRIMARY KEY NOT NULL,
  datetime TIMESTAMPTZ NOT NULL,
  "user" TEXT NOT NULL,
  recipient TEXT NOT NULL,
  users TEXT NOT NULL,
  message TEXT NOT NULL,
  type CHAR NOT NULL
);
