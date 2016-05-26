var config = {};

config.spotify = {};
config.google = {};

config.spotify.clientId = process.env.SPOTIFY_CLIENTID || 'clientid';
config.spotify.clientSecret = process.env.SPOTIFY_CLIENTSECRET || 'clientsecret';
config.spotify.userId = process.env.SPOTIFY_USERID || 'userid';
config.spotify.searchRegex = /New Day (.*?) (.*?)/i;


config.google.email = process.env.GOOGLE_EMAIL || 'username';
config.google.password = process.env.GOOGLE_PASSWORD || 'password';

module.exports = config;