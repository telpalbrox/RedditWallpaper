#!/usr/local/bin/node
var request = require('request');
var path = require('path');
var fs = require('fs');
var Magic = require('mmmagic').Magic;

var IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID || '5beb783df007abb';

// check if user pass a subreddit
var subReddit = process.argv[2] || 'wallpapers';
var wallpapersPath = 'https://www.reddit.com/r/' + subReddit + '/hot.json?t=week&limit=10';

// get download directory, by default /{userHome}/.redditWallpapers
var downloadDirectory = path.join(getUserHome(), '.redditWallpapers');

// request reddit API last hot posts
request(wallpapersPath, function(error, response, body) {
    if (error || response.statusCode != 200) {
        return console.error(error);
    }

    var redditResponse = JSON.parse(body);

    // iterate posts
    for (var i = 0; i < redditResponse.data.children.length; i++) {
        var item = redditResponse.data.children[i];

        // only download imgur links
        if (item.data.domain.indexOf('imgur.com') === -1) {
            continue;
        }

        // create folder if not exists
        mkdirSync(downloadDirectory);
        var imageUrl = redditResponse.data.children[i].data.url;

        if (isAlbum(imageUrl)) {
            var albumId = imageUrl.substr(imageUrl.lastIndexOf('/') + 1, imageUrl.length);

            request({
                url: 'https://api.imgur.com/3/album/' + albumId,
                headers: {
                    Authorization: 'Client-ID ' + IMGUR_CLIENT_ID
                }
            }, function(error, response, body) {
                if(error || response.statusCode != 200) {
                    console.error(error);
                    return;
                }
                var imgurResponse = JSON.parse(body);
                removeAllFilesFolder(downloadDirectory);
                for (var j = 0; j < imgurResponse.data.images.length; j++) {
                    downloadImage(downloadDirectory, imgurResponse.data.images[j].link, false);
                }
            });

        } else {
            // only download image if not exists
            downloadImage(downloadDirectory, imageUrl, true);
        }
        return;
    }
});

function getUserHome() {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function mkdirSync(path) {
    try {
        fs.mkdirSync(path);
    } catch(e) {
        if ( e.code != 'EEXIST' ) throw e;
    }
}

function isAlbum(imgurUrl) {
    return imgurUrl.match(/\/a\//gi);
}

function removeAllFilesFolder(folderPath) {
    var files = fs.readdirSync(folderPath);
    files.forEach(function (file) {
        // DANGER remove all files under /{userHome}/.redditWallpapers
        fs.unlinkSync(path.join(downloadDirectory, file));
    });
}

function downloadImage(downloadDirectory, imageUrl, removeImages) {
    var downloadPath = path.join(downloadDirectory, imageUrl.replace(/http:\/\//gi, '').replace(/\//gi, ''));

    // if not exists download image
    if (!fs.existsSync(downloadPath)) {

        if (removeImages) {
            removeAllFilesFolder(downloadDirectory);
        }
        request(imageUrl).pipe(fs.createWriteStream(downloadPath)).on('finish', function() {
            var magic = new Magic();
            magic.detectFile(downloadPath, function(err, result) {
                if (err) throw err;
                var extension = result.split(' ')[0].toLowerCase();
                fs.rename(downloadPath, downloadPath + '.' + extension);
            });
        });
    }
}
