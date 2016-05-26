var Promise = require('promise');
var async = require('async');
var SpotifyWebApi = require('spotify-web-api-node');
var pm = new (require('playmusic'));

var config = require('./config');

pm.init({email: config.google.email, password: config.google.password}, function() {});

var spotifyUserId = config.spotify.userId;

var spotifyApi = new SpotifyWebApi({
    clientId: config.spotify.clientId,
    clientSecret: config.spotify.clientSecret,
    redirectUri: 'http://example.com/callback'
});

var getLatestPlaylist = function() {

    return new Promise(function (fulfill, reject) {

        var playlistRe = /New Day (.*?) (.*?)/i;

        spotifyApi.getUserPlaylists(spotifyUserId)
            .then(function(data) {

                var playlists = data.body.items;

                var latestPlaylist;

                playlists.some(function(pl) {
                    var match = pl.name.match(playlistRe);

                    if (match) {
                        latestPlaylist = pl;
                    }

                    return match;
                }, this);

                var res = {id: latestPlaylist.id, name: latestPlaylist.name, songs: []};

                spotifyApi.getPlaylist(spotifyUserId, latestPlaylist.id)
                    .then(function(data) {

                        //console.log(data.body);

                        var tracks = data.body.tracks.items;

                        var songs = [];
                        var idx = 0;

                        tracks.forEach(function(o) {
                            var track = o.track;

                            var artists = [];
                            track.artists.forEach(function(a) {
                                artists.push(a.name);
                            })

                            var song = {Index: idx, Title: track.name, Artists: artists, Album: track.album.name};
                            songs.push(song);

                            idx++;

                            //console.log(song);
                        }, this);

                        res.songs = songs;

                        fulfill(res);

                        //console.log(songs.length);

                    }, function(err) {
                        reject(err);
                    });

            }, function(err) {
                reject(err);
            });

    });

};

var syncPlaylists = function(spotifyPlaylist, playlistId, addTracks) {
    console.log('Syncing ' + spotifyPlaylist.name + '...');

    var searchForSong = function(spotifySong, callback) {
        var searchString = (spotifySong.Title + " " + spotifySong.Artists[0]); //+ " " + spotifySong.Album);

        console.log('Searching for ' + searchString + '...');

        pm.search(searchString, 5, function(err, data) {

            var results = data.entries.filter(function(v) {return v.type === "1"});

            var song = results.sort(function(a, b) { // sort by match score
                return a.score < b.score;
            }).shift(); // take first song

            callback(null, {Index: spotifySong.Index, Track: song.track});
        });
    }

    async.map(spotifyPlaylist.songs, searchForSong, function(err, results) {
        var sorted = results.sort(function(a, b) {
            return a.Index > b.Index;
        })

        sorted.forEach(function(v) {
            if (addTracks) {
                setTimeout(function() {
                    pm.addTrackToPlayList(v.Track.nid, playlistId, function(err, data) {
                        console.log('Added ' + v.Track.title + ' to playlist...');
                    });
                }, 150 * v.Index);
            }
        }, this);
    });



}

spotifyApi.clientCredentialsGrant()
  .then(function(data) {
    console.log('The access token expires in ' + data.body['expires_in']);
    console.log('The access token is ' + data.body['access_token']);

    // Save the access token so that it's used in future calls
    spotifyApi.setAccessToken(data.body['access_token']);

    getLatestPlaylist().then(function (res){

        //console.log(res);

        pm.getPlayLists(function(err, data) {
            var playlists = data.data.items;

            var foundPlaylist;

            playlists.forEach(function(pl) {
                if (pl.description === res.id) {
                    foundPlaylist = pl;
                }
            }, this);

            if (typeof foundPlaylist === 'undefined') {
                console.log('Creating playlist');
                pm.addPlayList(res.name, function(err, data) {
                    pm.updatePlayListMeta(data.mutate_response[0].id, {description: res.id}, function () {});

                    syncPlaylists(res, data.mutate_response[0].id, true);
                });

            } else {
                console.log('Found playlist');
                
                pm.getPlayListEntries({}, function(err, data) {
                    var tracks = data.data.items.filter(function(v) {return v.playlistId === foundPlaylist.id});
                    
                    var trackIds = [];
                    tracks.forEach(function(t) {
                        trackIds.push(t.id);
                    }, this);
                    
                    console.log('Removing existing ' + trackIds.length + ' playlist entries...');
                    
                    pm.removePlayListEntry(trackIds, function(err, data) {
                        syncPlaylists(res, foundPlaylist.id, true);
                    });
                });
            }

        });

    }, function(err) {
        console.log('Something went wrong', err);
    });

  }, function(err) {
        console.log('Something went wrong when retrieving an access token', err);
  });
